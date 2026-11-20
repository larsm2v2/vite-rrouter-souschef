import axios from "axios";
import { API_BASE_URL } from "./apiBaseUrl";

// Owns the in-memory access token and keeps it fresh. Everything that needs a
// new token (the 401 interceptor, the page-load restore, the expiry timer, tab
// wake-ups) goes through refreshSession(), so only one refresh is ever in flight.
// The refresh token is rotated on every refresh, which makes concurrent refreshes
// the main way to accidentally lose a session.

/** Renew this long before the access token expires. */
export const REFRESH_AHEAD_MS = 60_000;
/** Treat a token that expires within this window as stale when the tab wakes up. */
export const STALE_WINDOW_MS = 90_000;
const RETRY_START_MS = 5_000;
const RETRY_MAX_MS = 60_000;
const MAX_TIMER_MS = 2 ** 31 - 1;

export type RefreshOutcome =
  | { status: "ok"; accessToken: string }
  /** The server rejected the refresh token: the session is really over. */
  | { status: "expired" }
  /** Network error, server down, rate limit...: the session may well still be valid. */
  | { status: "unavailable" };

let accessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();
const expiredListeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = RETRY_START_MS;
let inFlight: Promise<RefreshOutcome> | null = null;

/** The `exp` claim of a JWT in milliseconds, or null when it cannot be read. */
export function tokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getInMemoryAccessToken(): string | null {
  return accessToken;
}

export function setInMemoryAccessToken(token: string | null): void {
  accessToken = token;
  schedule();
  tokenListeners.forEach((listener) => listener(token));
}

/** Be told whenever the token changes (login, refresh, logout). */
export function subscribeToken(
  listener: (token: string | null) => void,
): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

/** Be told when the server says the session is over. */
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function notifySessionExpired(): void {
  expiredListeners.forEach((listener) => listener());
}

async function requestRefresh(): Promise<RefreshOutcome> {
  try {
    const response = await axios.post<{ accessToken?: string }>(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 15_000 },
    );
    const token = response.data?.accessToken;
    if (!token) return { status: "unavailable" };
    setInMemoryAccessToken(token);
    return { status: "ok", accessToken: token };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return status === 401 || status === 403
      ? { status: "expired" }
      : { status: "unavailable" };
  }
}

/** Serialize refreshes across tabs: they share one rotating cookie. */
function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  return locks?.request
    ? (locks.request("souschef-session-refresh", task) as Promise<T>)
    : task();
}

/** Renew the session. Concurrent callers share a single request. */
export function refreshSession(): Promise<RefreshOutcome> {
  if (!inFlight) {
    inFlight = withCrossTabLock(requestRefresh).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runScheduledRefresh(): Promise<void> {
  const outcome = await refreshSession();
  if (outcome.status === "ok") {
    retryDelay = RETRY_START_MS;
  } else if (outcome.status === "expired") {
    notifySessionExpired();
  } else {
    // Keep the session and try again; a flaky network must not sign anyone out.
    timer = setTimeout(() => void runScheduledRefresh(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const expiry = tokenExpiryMs(accessToken);
  if (expiry === null) return;
  // Renew a minute early, but never earlier than halfway through the token's
  // remaining life, so a very short-lived token cannot cause a refresh storm.
  const remaining = expiry - Date.now();
  const ahead = Math.min(REFRESH_AHEAD_MS, remaining / 2);
  const delay = Math.max(1_000, remaining - ahead);
  timer = setTimeout(() => void runScheduledRefresh(), Math.min(delay, MAX_TIMER_MS));
}

/**
 * Re-establish the session after a page load (the access token only lives in
 * memory). If the server is briefly unreachable this keeps retrying in the
 * background instead of signing the user out.
 */
export function restoreSession(): void {
  void runScheduledRefresh();
}

/** Refresh now if the token is missing-but-expected or about to expire (after sleep, offline...). */
export function refreshIfStale(): void {
  const expiry = tokenExpiryMs(accessToken);
  if (expiry !== null && expiry - Date.now() < STALE_WINDOW_MS) {
    void runScheduledRefresh();
  }
}

/**
 * Timers are throttled or frozen while a tab is hidden or the machine sleeps, so
 * also renew when the tab becomes visible or the network returns.
 */
export function startSessionKeepAlive(): () => void {
  if (typeof document === "undefined" || typeof window === "undefined")
    return () => undefined;
  const onVisible = () => {
    if (document.visibilityState === "visible") refreshIfStale();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", refreshIfStale);
  window.addEventListener("focus", refreshIfStale);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", refreshIfStale);
    window.removeEventListener("focus", refreshIfStale);
  };
}

/** Test helper: forget all state. */
export function resetSessionForTests(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  accessToken = null;
  inFlight = null;
  retryDelay = RETRY_START_MS;
  tokenListeners.clear();
  expiredListeners.clear();
}
