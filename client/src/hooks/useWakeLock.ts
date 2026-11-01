import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keep the screen awake while `wanted` is true. The lock is released by the browser
 * whenever the page is hidden, so it is re-requested when the page becomes visible.
 */
export function useWakeLock(wanted: boolean) {
  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.wakeLock?.request === "function";
  const [enabled, setEnabled] = useState(wanted);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const pendingRef = useRef(false);
  const aliveRef = useRef(true);

  const acquire = useCallback(async () => {
    if (!supported || sentinelRef.current || pendingRef.current) return;
    pendingRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (!aliveRef.current) {
        void sentinel.release();
        return;
      }
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        if (aliveRef.current) setActive(false);
      });
    } catch {
      // power saver, low battery, or hidden page: the screen simply may sleep
      if (aliveRef.current) setActive(false);
    } finally {
      pendingRef.current = false;
    }
  }, [supported]);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        // already released
      }
    }
    if (aliveRef.current) setActive(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) {
      void release();
      return;
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, acquire, release]);

  useEffect(
    () => () => {
      aliveRef.current = false;
      void sentinelRef.current?.release().catch(() => undefined);
      sentinelRef.current = null;
    },
    [],
  );

  return { supported, enabled, active, setEnabled };
}
