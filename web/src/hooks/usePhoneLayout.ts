"use client";

import { useSyncExternalStore } from "react";

/** Phone layout — touch sizing, bottom nav, card layouts (≤768px). */
export const PHONE_LAYOUT_MEDIA = "(max-width: 768px)";

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
