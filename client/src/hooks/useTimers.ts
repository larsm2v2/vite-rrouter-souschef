import { useCallback, useEffect, useState } from "react";
import { useUserStorage } from "./useUserStorage";
import { playTimerAlert, unlockAudio } from "../utils/timerAlert";

export interface TimerItem {
  id: string;
  label: string;
  durationMs: number;
  /** Absolute end time while running; null when paused or finished. */
  endsAt: number | null;
  /** Remaining time while paused. */
  remainingMs: number | null;
  finished: boolean;
}

const TIMER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_TIMERS = 12;

export function timerRemainingMs(timer: TimerItem, now: number): number {
  if (timer.finished) return 0;
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  return timer.remainingMs ?? 0;
}

/**
 * Per-recipe timers. Running timers store an absolute end time, so a throttled
 * or backgrounded tab still shows the right value when it wakes up.
 */
export function useTimers(recipeId: string | undefined) {
  const [timers, setTimers] = useUserStorage<TimerItem[]>(
    "timers",
    recipeId,
    [],
    {
      maxAgeMs: TIMER_MAX_AGE_MS,
    },
  );
  const [now, setNow] = useState(() => Date.now());
  const anyRunning = timers.some((t) => t.endsAt !== null);

  useEffect(() => {
    if (!anyRunning) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [anyRunning]);

  useEffect(() => {
    const due = timers.filter(
      (t) => !t.finished && t.endsAt !== null && t.endsAt <= now,
    );
    if (due.length === 0) return;
    setTimers((prev) =>
      prev.map((t) =>
        due.some((d) => d.id === t.id)
          ? { ...t, finished: true, endsAt: null, remainingMs: 0 }
          : t,
      ),
    );
    playTimerAlert();
  }, [now, timers, setTimers]);

  const start = useCallback(
    (label: string, seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      unlockAudio();
      const startedAt = Date.now();
      setNow(startedAt);
      setTimers((prev) => {
        const duplicate = prev.some(
          (t) =>
            !t.finished && t.label === label && t.durationMs === seconds * 1000,
        );
        if (duplicate || prev.length >= MAX_TIMERS) return prev;
        const id = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
        return [
          ...prev,
          {
            id,
            label,
            durationMs: seconds * 1000,
            endsAt: startedAt + seconds * 1000,
            remainingMs: null,
            finished: false,
          },
        ];
      });
    },
    [setTimers],
  );

  const update = useCallback(
    (id: string, fn: (t: TimerItem, at: number) => TimerItem) => {
      const at = Date.now();
      setNow(at);
      setTimers((prev) => prev.map((t) => (t.id === id ? fn(t, at) : t)));
    },
    [setTimers],
  );

  const pause = useCallback(
    (id: string) =>
      update(id, (t, at) =>
        t.endsAt === null || t.finished
          ? t
          : { ...t, endsAt: null, remainingMs: Math.max(0, t.endsAt - at) },
      ),
    [update],
  );

  const resume = useCallback(
    (id: string) =>
      update(id, (t, at) =>
        t.endsAt !== null || t.finished
          ? t
          : { ...t, endsAt: at + (t.remainingMs ?? 0), remainingMs: null },
      ),
    [update],
  );

  const addMinute = useCallback(
    (id: string) =>
      update(id, (t, at) => {
        if (t.finished)
          return {
            ...t,
            finished: false,
            endsAt: at + 60_000,
            remainingMs: null,
            durationMs: 60_000,
          };
        if (t.endsAt !== null)
          return {
            ...t,
            endsAt: t.endsAt + 60_000,
            durationMs: t.durationMs + 60_000,
          };
        return {
          ...t,
          remainingMs: (t.remainingMs ?? 0) + 60_000,
          durationMs: t.durationMs + 60_000,
        };
      }),
    [update],
  );

  const dismiss = useCallback(
    (id: string) => setTimers((prev) => prev.filter((t) => t.id !== id)),
    [setTimers],
  );

  return { timers, now, start, pause, resume, addMinute, dismiss };
}
