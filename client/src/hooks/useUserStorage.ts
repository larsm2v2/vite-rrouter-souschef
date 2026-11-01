import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  readStored,
  removeStored,
  storageKey,
  writeStored,
} from "../utils/userStorage";

interface Options {
  maxAgeMs?: number;
}

/**
 * State persisted per user and feature. Falls back to plain state when there is
 * no signed-in user, and never throws if browser storage is unavailable.
 */
export function useUserStorage<T>(
  feature: string,
  id: string | undefined,
  initial: T,
  options: Options = {},
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const { user } = useAuth();
  const key =
    user?.id !== undefined && id ? storageKey(user.id, feature, id) : null;
  const initialRef = useRef(initial);
  const { maxAgeMs } = options;

  const load = useCallback(
    (k: string | null): T =>
      k
        ? (readStored<T>(k, maxAgeMs) ?? initialRef.current)
        : initialRef.current,
    [maxAgeMs],
  );

  const [state, setState] = useState<{ key: string | null; value: T }>(() => ({
    key,
    value: load(key),
  }));

  if (state.key !== key) setState({ key, value: load(key) });

  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setState((current) => {
      const value =
        typeof next === "function"
          ? (next as (prev: T) => T)(current.value)
          : next;
      if (current.key) writeStored(current.key, value);
      return { key: current.key, value };
    });
  }, []);

  const clear = useCallback(() => {
    if (keyRef.current) removeStored(keyRef.current);
    setState((current) => ({ key: current.key, value: initialRef.current }));
  }, []);

  // Keep tabs in sync: another tab writing the same key updates this one.
  useEffect(() => {
    if (!key) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      setState({ key, value: load(key) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, load]);

  return [state.value, setValue, clear];
}
