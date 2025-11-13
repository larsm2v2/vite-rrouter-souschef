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
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
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
    const requestWithRetry = originalRequest as typeof originalRequest & { _retry?: boolean };

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

      try {
        // Try to refresh the token by calling refresh endpoint which reads HttpOnly cookie
        const response = await axios.post<{ accessToken: string }>(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken: newAccessToken } = response.data;

        // Store new access token
        localStorage.setItem("accessToken", newAccessToken);

        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        // Process queued requests
        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        processQueue(refreshError, null);
        isRefreshing = false;

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

