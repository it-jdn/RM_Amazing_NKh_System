"use client";

import { useSyncExternalStore } from "react";

/** Desktop layout — top nav tabs, intake table, history table list (≥1025px). */
export const DESKTOP_LAYOUT_MEDIA = "(min-width: 1025px)";

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
