import { useEffect, useRef, type RefObject } from "react";

type Options = {
  open: boolean;
  onClose: () => void;
  /** When true, Escape does not close (e.g. while saving). */
  busy?: boolean;
  /** Focus once per open — never re-runs when parent re-renders. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Modal shell: body scroll lock, Escape to close, optional one-time initial focus.
 * Use instead of calling .focus() inside effects that depend on unstable callbacks.
 */
export function useModalLayer({ open, onClose, busy = false, initialFocusRef }: Options) {
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const didInitialFocusRef = useRef(false);

  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) {
      didInitialFocusRef.current = false;
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !initialFocusRef || didInitialFocusRef.current) return;
    didInitialFocusRef.current = true;
    const id = window.setTimeout(() => initialFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, initialFocusRef]);
}
