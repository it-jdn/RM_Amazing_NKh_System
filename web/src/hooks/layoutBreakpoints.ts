"use client";

export const PHONE_MAX_WIDTH = 768;
export const TABLET_MAX_WIDTH = 1024;

/** Admin compact mode should match the tablet/drawer cutover to avoid awkward iPad in-between states. */
export const COMPACT_ADMIN_MAX_WIDTH = TABLET_MAX_WIDTH;

export const PHONE_LAYOUT_MEDIA = `(max-width: ${PHONE_MAX_WIDTH}px)`;
export const DRAWER_NAV_MEDIA = `(max-width: ${TABLET_MAX_WIDTH}px)`;
export const DESKTOP_LAYOUT_MEDIA = `(min-width: ${TABLET_MAX_WIDTH + 1}px)`;
export const COMPACT_ADMIN_MEDIA = `(max-width: ${COMPACT_ADMIN_MAX_WIDTH}px)`;
