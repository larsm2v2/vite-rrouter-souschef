import axios from "axios";
import { API_BASE_URL } from "../../utils/apiBaseUrl";
import {
  getInMemoryAccessToken,
  notifySessionExpired,
  refreshSession,
  setInMemoryAccessToken,
} from "../../utils/authSession";

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

// The access token lives in memory only (never localStorage) to limit what an XSS
// bug can steal; utils/authSession.ts owns it and keeps it fresh. These names are
// re-exported so existing imports keep working.
export { getInMemoryAccessToken, setInMemoryAccessToken };

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
  baseURL: API_BASE_URL,
  withCredentials: true, // Use cookies for refresh token (HttpOnly)
  headers: {
    "Content-Type": "application/json",
  },
  // Extend timeout to allow slower puzzle validation
  timeout: 30000,
});

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
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);

// A 401 from these means "wrong credentials" or "session already gone", not "token expired".
const NO_REFRESH_URL = /^\/?auth\/(login|register|refresh|logout)\b|\/api\/oauth\//;

apiClient.interceptors.response.use(
  (response) => {
    const controller = (
      response.config as typeof response.config & RequestConfigWithController
    ).__abortController;
    if (controller) inFlightControllers.delete(controller);
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

    // The access token expired (or was never loaded): renew it once, then retry.
    // refreshSession() is shared, so a burst of 401s causes one refresh, not many.
    if (
      error.response.status === 401 &&
      !requestWithRetry._retry &&
      !NO_REFRESH_URL.test(String(originalRequest.url ?? ""))
    ) {
      requestWithRetry._retry = true;
      const outcome = await refreshSession();

      if (outcome.status === "ok") {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${outcome.accessToken}`;
        }
        return apiClient(originalRequest);
      }

      if (outcome.status === "expired") {
        // The server says the session is really over.
        notifySessionExpired();
        return Promise.reject(error);
      }

      // Could not reach the server to renew. Keep the session; a background retry continues.
      return Promise.reject({
        isConnectionError: true,
        message: "Cannot reach the server to renew your session. Retrying…",
      });
    }

    return Promise.reject(error);
  },
);

export default apiClient;
