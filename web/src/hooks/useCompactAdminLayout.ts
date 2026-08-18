"use client";

import { useSyncExternalStore } from "react";
import { COMPACT_ADMIN_MEDIA } from "@/hooks/layoutBreakpoints";

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
