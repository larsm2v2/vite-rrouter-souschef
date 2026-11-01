import FocusTrap from "focus-trap-react";
import { useToastViewport } from "./toastViewport";

interface Props {
  active: boolean;
  /** The element to trap focus in; render it yourself and pass it in with a ref callback. */
  container: HTMLElement | null;
  focusTrapOptions: NonNullable<FocusTrap.Props["focusTrapOptions"]>;
}

/**
 * A focus trap that also lets focus reach toasts. Without this the trap pulls focus back
 * into the dialog, so a keyboard user can never reach a toast's Undo button.
 */
export default function ToastSafeFocusTrap({
  active,
  container,
  focusTrapOptions,
}: Props) {
  const viewport = useToastViewport();
  const elements = [container, viewport].filter(
    (el): el is HTMLElement => el !== null,
  );
  return (
    <FocusTrap
      active={active && container !== null}
      containerElements={elements}
      focusTrapOptions={focusTrapOptions}
    />
  );
}
