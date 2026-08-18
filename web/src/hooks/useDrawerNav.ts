"use client";

import { useSyncExternalStore } from "react";
import { DRAWER_NAV_MEDIA } from "@/hooks/layoutBreakpoints";

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
