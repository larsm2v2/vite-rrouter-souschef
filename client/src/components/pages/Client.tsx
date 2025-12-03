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
    // Add JWT token to requests
    const accessToken = localStorage.getItem("accessToken");
    // console.log("API Request Interceptor - Token present:", !!accessToken);
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      // console.log("API Request Interceptor - Authorization header set");
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      // console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  }
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
        localStorage.removeItem("accessToken");
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
          }
        );

        console.debug("Refresh response:", response.status, response.data);
        const { accessToken: newAccessToken } = response.data;

        // Store new access token
        localStorage.setItem("accessToken", newAccessToken);

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
        const isRateLimit = axios.isAxiosError(refreshError)
          ? refreshError.response?.status === 429
          : false;

        if (isRateLimit) {
          console.warn("Rate limited on refresh, will retry after cooldown");
          // Don't log out immediately on rate limit, let cooldown handle it
          return Promise.reject(refreshError);
        }

        localStorage.removeItem("accessToken");
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
  }
);

export default apiClient;
