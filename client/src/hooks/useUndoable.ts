import { useCallback } from "react";
import { useToast } from "../components/common/Toast";

interface UndoableOptions {
  message: string;
  /** Applies the change to the UI right away. */
  apply: () => void;
  /** Puts things back exactly as they were. */
  revert: () => void;
  /** Runs only if the user did not undo (for irreversible server work). */
  commit?: () => void | Promise<void>;
  windowMs?: number;
}

const DEFAULT_WINDOW_MS = 8000;

/**
 * Optimistic action with an Undo toast. The commit runs when the toast goes away, so hovering or
 * focusing it keeps Undo available. It is also flushed if the page is hidden, so a pending action
 * is never silently lost.
 */
export function useUndoable() {
  const { showToast } = useToast();

  return useCallback(
    ({
      message,
      apply,
      revert,
      commit,
      windowMs = DEFAULT_WINDOW_MS,
    }: UndoableOptions) => {
      apply();
      let settled = false;

      const onHidden = () => {
        if (document.visibilityState === "hidden") flush();
      };
      const detach = () => {
        document.removeEventListener("visibilitychange", onHidden);
        window.removeEventListener("pagehide", flush);
      };
      function flush() {
        if (settled) return;
        settled = true;
        detach();
        void commit?.();
      }

      showToast(message, "info", {
        durationMs: windowMs,
        onClose: flush,
        action: {
          label: "Undo",
          onClick: () => {
            if (settled) return;
            settled = true;
            detach();
            revert();
          },
        },
      });
      document.addEventListener("visibilitychange", onHidden);
      window.addEventListener("pagehide", flush);
    },
    [showToast],
  );
}
