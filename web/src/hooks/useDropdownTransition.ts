import { useEffect, useRef, useState } from "react";

/** Fade + slide for portaled / anchored dropdown panels. */
export function useDropdownTransition(open: boolean, durationMs = 280) {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (open) setVisible(true);
    else setEntered(false);
  }, [open]);

  useEffect(() => {
    if (!visible || !open) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [visible, open]);

  useEffect(() => {
    if (open || !visible) return;
    const el = panelRef.current;
    if (!el) {
      setVisible(false);
      return;
    }
    function onEnd(e: TransitionEvent) {
      if (e.target !== el) return;
      if (e.propertyName === "opacity" || e.propertyName === "transform") {
        setVisible(false);
      }
    }
    el.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(() => setVisible(false), durationMs + 50);
    return () => {
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [open, visible, durationMs]);

  return { visible, entered, panelRef };
}
