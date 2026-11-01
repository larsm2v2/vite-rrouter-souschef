import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./Toast.css";

export type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  /** A single follow-up action, typically "Undo". */
  action?: { label: string; onClick: () => void };
  durationMs?: number;
  /** Runs once when the toast goes away for any reason (timeout, dismissed, action, or evicted). */
  onClose?: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastOptions["action"];
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    options?: ToastOptions,
  ) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATION_MS = 3500;
const ACTION_DURATION_MS = 8000;
const MAX_VISIBLE = 3;

interface Timer {
  handle: number | null;
  remaining: number;
  startedAt: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, Timer>());
  const closers = useRef(new Map<number, () => void>());
  const order = useRef<number[]>([]);

  const clearTimer = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t?.handle) window.clearTimeout(t.handle);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      order.current = order.current.filter((x) => x !== id);
      setToasts((current) => current.filter((t) => t.id !== id));
      const onClose = closers.current.get(id);
      closers.current.delete(id);
      onClose?.();
    },
    [clearTimer],
  );

  const schedule = useCallback(
    (id: number, ms: number) => {
      const handle = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { handle, remaining: ms, startedAt: Date.now() });
    },
    [dismiss],
  );

  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t || t.handle === null) return;
    window.clearTimeout(t.handle);
    timers.current.set(id, {
      handle: null,
      remaining: Math.max(1000, t.remaining - (Date.now() - t.startedAt)),
      startedAt: 0,
    });
  }, []);

  const resume = useCallback(
    (id: number) => {
      const t = timers.current.get(id);
      if (!t || t.handle !== null) return;
      schedule(id, t.remaining);
    },
    [schedule],
  );

  const showToast = useCallback(
    (message: string, type: ToastType = "info", options: ToastOptions = {}) => {
      const id = ++nextId.current;
      const duration =
        options.durationMs ??
        (options.action ? ACTION_DURATION_MS : DEFAULT_DURATION_MS);
      if (options.onClose) closers.current.set(id, options.onClose);
      order.current.push(id);
      setToasts((current) => [
        ...current,
        { id, message, type, action: options.action },
      ]);
      schedule(id, duration);
      // Evict the oldest toasts beyond the cap; their onClose still runs.
      while (order.current.length > MAX_VISIBLE) {
        const oldest = order.current[0];
        dismiss(oldest);
      }
      return id;
    },
    [dismiss, schedule],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => t.handle && window.clearTimeout(t.handle));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: dismiss }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            role="status"
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={() => resume(t.id)}
          >
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
