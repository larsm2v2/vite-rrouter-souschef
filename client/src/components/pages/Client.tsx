import axios from "axios";

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

interface QueueItem {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

// Get the API URL from environment variables or use default
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// --- In-memory access token store ------------------------------------------
// The access token is intentionally kept in memory only (never persisted to
// localStorage/sessionStorage) to reduce the blast radius of an XSS bug --
// any injected script that can read localStorage would otherwise be able to
// exfiltrate a live session token. On page load there is no cached token;
// AuthContext performs a silent refresh via the HttpOnly refresh-token
// cookie to repopulate it (see AuthContext's mount effect).
let inMemoryAccessToken: string | null = null;

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setInMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

// --- In-flight request cancellation (for logout) ----------------------------
// Tracks an AbortController per outgoing request so that logout() can cancel
// every pending request. Without this, a slow request that resolves after
// logout could still run its .then()/setState handler and repopulate the UI
// with the previous user's data.
const inFlightControllers = new Set<AbortController>();

export function abortAllInFlightRequests(): void {
  inFlightControllers.forEach((controller) => controller.abort());
  inFlightControllers.clear();
}

interface RequestConfigWithController {
  __abortController?: AbortController;
}

// Create a typed wrapper around Axios
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Use cookies for refresh token (HttpOnly)
  headers: {
    "Content-Type": "application/json",
  },
  // Extend timeout to allow slower puzzle validation
  timeout: 30000,
});

// Add request interceptor for debugging and JWT token
apiClient.interceptors.request.use(
  (config) => {
    // Add JWT token to requests (from memory, never from localStorage)
    const accessToken = getInMemoryAccessToken();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Track this request so it can be aborted on logout, unless the caller
    // already supplied their own AbortSignal.
    if (!config.signal) {
      const controller = new AbortController();
      config.signal = controller.signal;
      inFlightControllers.add(controller);
      (
        config as typeof config & RequestConfigWithController
      ).__abortController = controller;
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      // console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);

// Track the last auth redirect to avoid loops
let lastAuthRedirect = 0;
const redirectDebounceTime = 2000; // 2 seconds

// Token refresh state
let isRefreshing = false;
let failedQueue: QueueItem[] = [];
let refreshAttempts = 0;
let lastRefreshAttempt = 0;
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_COOLDOWN = 5000; // 5 seconds between refresh attempts

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Response interceptor for consistent typing and token refresh
apiClient.interceptors.response.use(
  (response) => {
    const controller = (
      response.config as typeof response.config & RequestConfigWithController
    ).__abortController;
    if (controller) inFlightControllers.delete(controller);

    // Log successful responses in development
    if (import.meta.env.DEV) {
      console.log(`Response: ${response.status} ${response.config?.url}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const controller = (
      originalRequest as typeof originalRequest & RequestConfigWithController
    ).__abortController;
    if (controller) inFlightControllers.delete(controller);

    // Add retry flag
    const requestWithRetry = originalRequest as typeof originalRequest & {
      _retry?: boolean;
    };

    // Handle network errors - connection refused, server not running
    if (
      error.code === "ECONNABORTED" ||
      error.message === "Network Error" ||
      !error.response
    ) {
      console.error("Network error - server might be down:", error.message);
      return Promise.reject({
        isConnectionError: true,
        message:
          "Cannot connect to server. Please ensure the server is running.",
      });
    }

    // Handle unauthorized - token expired or not logged in
    if (error.response?.status === 401 && !requestWithRetry._retry) {
      const now = Date.now();

      // Check if we're in cooldown period
      if (now - lastRefreshAttempt < REFRESH_COOLDOWN) {
        console.warn("Refresh attempt too soon, waiting for cooldown...");
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }

      // Check if we've exceeded max attempts
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.error("Max refresh attempts exceeded, logging out...");
        setInMemoryAccessToken(null);
        localStorage.removeItem("user");
        processQueue(new Error("Max refresh attempts exceeded"), null);
        failedQueue = [];
        isRefreshing = false;

        if (now - lastAuthRedirect > redirectDebounceTime) {
          lastAuthRedirect = now;
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      console.warn("API client received 401, attempting refresh...");
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      requestWithRetry._retry = true;
      isRefreshing = true;
      lastRefreshAttempt = now;
      refreshAttempts++;

      try {
        // Try to refresh the token by calling refresh endpoint which reads HttpOnly cookie
        console.debug("Calling refresh endpoint:", `${API_URL}/auth/refresh`);
        const response = await axios.post<{ accessToken: string }>(
          `${API_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            timeout: 10000, // 10 second timeout for refresh
          },
        );

        console.debug("Refresh response status:", response.status);
        const { accessToken: newAccessToken } = response.data;

        // Store new access token in memory only
        setInMemoryAccessToken(newAccessToken);

        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        // Reset attempts on success
        refreshAttempts = 0;

        // Process queued requests
        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        processQueue(refreshError, null);
        isRefreshing = false;

        // Only log out if it's not a rate limit error
        // Type guard for axios error with response
        const isAxiosErrorWithResponse = (
          error: unknown,
        ): error is { response: { status: number } } => {
          return (
            typeof error === "object" && error !== null && "response" in error
          );
        };

        const isRateLimit =
          isAxiosErrorWithResponse(refreshError) &&
          refreshError.response?.status === 429;

        if (isRateLimit) {
          console.warn("Rate limited on refresh, will retry after cooldown");
          // Don't log out immediately on rate limit, let cooldown handle it
          return Promise.reject(refreshError);
        }

        setInMemoryAccessToken(null);
        localStorage.removeItem("user");

        const now = Date.now();
        if (now - lastAuthRedirect > redirectDebounceTime) {
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/login")) {
            lastAuthRedirect = now;
            console.log("Token refresh failed, redirecting to login");
            window.location.href = "/login";
          }
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
