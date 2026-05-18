import type { AppRole } from "@/lib/types";

/** Default landing page after login */
export function getHomePath(role: AppRole): string {
  return role === "operator" ? "/intake" : "/history";
}
