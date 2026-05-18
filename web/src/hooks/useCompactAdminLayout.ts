"use client";

import { useSyncExternalStore } from "react";

/** Admin settings: stack list + form sheet (matches globals.css admin split breakpoint). */
export const COMPACT_ADMIN_MEDIA = "(max-width: 960px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(COMPACT_ADMIN_MEDIA);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(COMPACT_ADMIN_MEDIA).matches;
}

export function useCompactAdminLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
