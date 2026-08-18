"use client";

import { useSyncExternalStore } from "react";
import { DESKTOP_LAYOUT_MEDIA } from "@/hooks/layoutBreakpoints";

function subscribeDesktopLayout(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_LAYOUT_MEDIA);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getDesktopLayoutSnapshot() {
  return window.matchMedia(DESKTOP_LAYOUT_MEDIA).matches;
}

export function useDesktopLayout(): boolean {
  return useSyncExternalStore(subscribeDesktopLayout, getDesktopLayoutSnapshot, () => true);
}
