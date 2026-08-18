"use client";

import { useSyncExternalStore } from "react";
import { PHONE_LAYOUT_MEDIA } from "@/hooks/layoutBreakpoints";

function subscribePhoneLayout(onChange: () => void) {
  const mq = window.matchMedia(PHONE_LAYOUT_MEDIA);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getPhoneLayoutSnapshot() {
  return window.matchMedia(PHONE_LAYOUT_MEDIA).matches;
}

export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribePhoneLayout, getPhoneLayoutSnapshot, () => false);
}
