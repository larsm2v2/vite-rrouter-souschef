import axios, { AxiosInstance, AxiosResponse } from "axios";

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

// Get the API URL from environment variables or use default
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Create a typed wrapper around Axios
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  // Extend timeout to allow slower puzzle validation
  timeout: 30000,
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    // Log requests in development
    if (import.meta.env.DEV) {
      console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track the last auth redirect to avoid loops
let lastAuthRedirect = 0;
const redirectDebounceTime = 2000; // 2 seconds

// Response interceptor for consistent typing
apiClient.interceptors.response.use(
  <T,>(response: AxiosResponse<T>): AxiosResponse<T> => {
    // Log successful responses in development
    if (import.meta.env.DEV) {
      console.log(`Response: ${response.status} ${response.config.url}`);
    }
    return {
      ...response,
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config: response.config,
    };
  },
  (error) => {
    // Don't log cancellation errors (they're intentional and not actual errors)
    if (axios.isCancel(error)) {
      // Simply pass it through without logging for cancellation errors
      return Promise.reject({
        isConnectionError: true,
        message: "Request was cancelled",
        isCancelled: true,
      });
    }

    // Handle network errors - connection refused, server not running
    if (
      error.code === "ECONNABORTED" ||
      error.message === "Network Error" ||
      !error.response
    ) {
      console.error("Network error - server might be down:", error.message);
      // You can handle this differently without redirecting
      return Promise.reject({
        isConnectionError: true,
        message:
          "Cannot connect to server. Please ensure the server is running.",
      });
    }

    // Handle unauthorized - session expired or not logged in
    if (error.response?.status === 401) {
      // Prevent redirect loops by checking time since last redirect
      const now = Date.now();
      if (now - lastAuthRedirect > redirectDebounceTime) {
        // Only redirect if we're not already on the login page
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/login")) {
          lastAuthRedirect = now;
          console.log("Auth failed, redirecting to login");
          window.location.href = "/login";
        }
      } else {
        console.log("Suppressing duplicate auth redirect");
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
