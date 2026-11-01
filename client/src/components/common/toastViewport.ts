import { createContext, useContext } from "react";

export const ToastViewportContext = createContext<HTMLElement | null>(null);

/** The element toasts render into, so a focus trap can treat it as part of the trap. */
export function useToastViewport(): HTMLElement | null {
  return useContext(ToastViewportContext);
}
