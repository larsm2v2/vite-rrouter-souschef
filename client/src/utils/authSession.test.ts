import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    isAxiosError: (error: unknown) =>
      Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
  },
}));

import {
  REFRESH_AHEAD_MS,
  onSessionExpired,
  refreshIfStale,
  refreshSession,
  resetSessionForTests,
  setInMemoryAccessToken,
  subscribeToken,
  tokenExpiryMs,
} from "./authSession";

/** A JWT-shaped token whose exp is `inMs` from now. */
function tokenExpiringIn(inMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor((Date.now() + inMs) / 1000) }),
  ).toString("base64url");
  return `header.${payload}.sig`;
}

const axiosError = (status?: number) =>
  Object.assign(new Error("failed"), {
    isAxiosError: true,
    response: status ? { status } : undefined,
  });

describe("tokenExpiryMs", () => {
  it("reads exp from a JWT and returns null for anything else", () => {
    const token = tokenExpiringIn(60_000);
    expect(tokenExpiryMs(token)).toBeGreaterThan(Date.now());
    expect(tokenExpiryMs("not-a-jwt")).toBeNull();
    expect(tokenExpiryMs("a.e30.c")).toBeNull(); // payload {} has no exp
    expect(tokenExpiryMs(null)).toBeNull();
  });
});

describe("session refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    post.mockReset();
    resetSessionForTests();
  });
  afterEach(() => {
    resetSessionForTests();
    vi.useRealTimers();
  });

  it("shares one request between concurrent callers and stores the new token", async () => {
    const fresh = tokenExpiringIn(15 * 60_000);
    post.mockResolvedValue({ data: { accessToken: fresh } });
    const seen: (string | null)[] = [];
    subscribeToken((token) => seen.push(token));

    const [a, b, c] = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    expect(post).toHaveBeenCalledTimes(1);
    expect([a, b, c].every((o) => o.status === "ok")).toBe(true);
    expect(seen).toEqual([fresh]);
  });

  it("allows a new refresh once the previous one finished", async () => {
    post.mockResolvedValue({ data: { accessToken: tokenExpiringIn(900_000) } });
    await refreshSession();
    await refreshSession();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("reports an expired session only when the server rejects the refresh token", async () => {
    post.mockRejectedValueOnce(axiosError(401));
    expect(await refreshSession()).toEqual({ status: "expired" });
    post.mockRejectedValueOnce(axiosError(403));
    expect(await refreshSession()).toEqual({ status: "expired" });
  });

  it("does not treat network errors, 5xx or rate limits as a lost session", async () => {
    for (const failure of [axiosError(), axiosError(500), axiosError(429)]) {
      post.mockRejectedValueOnce(failure);
      expect(await refreshSession()).toEqual({ status: "unavailable" });
    }
  });

  it("renews the token a minute before it expires, without any request failing first", async () => {
    post.mockImplementation(async () => ({
      data: { accessToken: tokenExpiringIn(15 * 60_000) },
    }));
    setInMemoryAccessToken(tokenExpiringIn(15 * 60_000));

    await vi.advanceTimersByTimeAsync(15 * 60_000 - REFRESH_AHEAD_MS - 5_000);
    expect(post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("does not hammer the server when tokens are very short-lived", async () => {
    post.mockImplementation(async () => ({
      data: { accessToken: tokenExpiringIn(40_000) },
    }));
    setInMemoryAccessToken(tokenExpiringIn(40_000));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    // renewed halfway through each 40s token (every ~20s), not every second
    expect(post.mock.calls.length).toBeLessThanOrEqual(31);
    expect(post.mock.calls.length).toBeGreaterThanOrEqual(25);
  });

  it("keeps renewing on a schedule across many cycles", async () => {
    post.mockImplementation(async () => ({
      data: { accessToken: tokenExpiringIn(15 * 60_000) },
    }));
    setInMemoryAccessToken(tokenExpiringIn(15 * 60_000));
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000); // two hours of idle time
    // one refresh about every 14 minutes
    expect(post.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(post.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it("retries with backoff on a flaky network and never signs the user out", async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    post
      .mockRejectedValueOnce(axiosError())
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValue({ data: { accessToken: tokenExpiringIn(15 * 60_000) } });
    setInMemoryAccessToken(tokenExpiringIn(2 * 60_000));

    await vi.advanceTimersByTimeAsync(61_000); // first scheduled attempt fails
    expect(post).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000); // retry after 5s fails
    expect(post).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000); // retry after 10s succeeds
    expect(post).toHaveBeenCalledTimes(3);
    expect(expired).not.toHaveBeenCalled();
  });

  it("notifies once when the server ends the session, and stops retrying", async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    post.mockRejectedValue(axiosError(401));
    setInMemoryAccessToken(tokenExpiringIn(2 * 60_000));

    await vi.advanceTimersByTimeAsync(61_000);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("refreshes straight away when a woken-up tab holds a nearly expired token", async () => {
    post.mockResolvedValue({ data: { accessToken: tokenExpiringIn(900_000) } });
    setInMemoryAccessToken(tokenExpiringIn(30_000));
    // the timer was frozen while asleep; the wake-up hook must not wait for it
    refreshIfStale();
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(1);

    post.mockClear();
    setInMemoryAccessToken(tokenExpiringIn(10 * 60_000));
    refreshIfStale(); // plenty of time left: nothing to do
    await vi.advanceTimersByTimeAsync(0);
    expect(post).not.toHaveBeenCalled();
  });

  it("stops the timer when the token is cleared (logout)", async () => {
    setInMemoryAccessToken(tokenExpiringIn(2 * 60_000));
    setInMemoryAccessToken(null);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(post).not.toHaveBeenCalled();
  });
});
