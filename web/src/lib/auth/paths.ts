import type { AppRole } from "@/lib/types";

/** Receive-goods page (formerly /intake) */
export const RECEIVING_PATH = "/receiving";

/** Default landing page after login (all roles) */
export function getHomePath(_role: AppRole): string {
  return RECEIVING_PATH;
}
