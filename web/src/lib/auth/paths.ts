import type { AppRole } from "@/lib/types";

/** Receive-goods page (formerly /intake) */
export const RECEIVING_PATH = "/receiving";

/** Default landing page after login */
export function getHomePath(role: AppRole): string {
  return role === "operator" ? RECEIVING_PATH : "/history";
}
