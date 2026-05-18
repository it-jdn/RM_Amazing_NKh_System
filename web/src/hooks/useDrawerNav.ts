"use client";

import { useSyncExternalStore } from "react";

/** Matches mobile drawer nav (hamburger); keep in sync with globals.css `.nav--drawer` rules. */
export const DRAWER_NAV_MEDIA = "(max-width: 768px)";

function subscribeDrawerNav(onChange: () => void) {
  const mq = window.matchMedia(DRAWER_NAV_MEDIA);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getDrawerNavSnapshot() {
  return window.matchMedia(DRAWER_NAV_MEDIA).matches;
}

export function useDrawerNav(): boolean {
  return useSyncExternalStore(subscribeDrawerNav, getDrawerNavSnapshot, () => false);
}
