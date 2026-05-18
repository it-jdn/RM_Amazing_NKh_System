import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/types";
import { verifyPin } from "@/lib/users/pin";

type PinUserRow = { id: string; pin_hash: string };

/** Users in `rows` whose PIN matches `pin` (bcrypt compare). */
export async function findUsersWithMatchingPin(
  rows: PinUserRow[],
  pin: string
): Promise<PinUserRow[]> {
  const matched: PinUserRow[] = [];
  for (const row of rows) {
    if (row.pin_hash && (await verifyPin(pin, row.pin_hash))) {
      matched.push(row);
    }
  }
  return matched;
}

/** Returns error message if another active user in the same role already uses this PIN. */
export async function assertPinUniqueInRole(
  supabase: SupabaseClient,
  pin: string,
  role: AppRole,
  excludeUserId?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_users")
    .select("id, pin_hash")
    .eq("role", role)
    .eq("active", true);

  if (error) throw error;

  const others = (data || []).filter((u) => u.id !== excludeUserId);
  const dupes = await findUsersWithMatchingPin(others, pin);
  if (dupes.length > 0) {
    return "PIN นี้ถูกใช้โดยผู้ใช้อื่นในบทบาทเดียวกันแล้ว กรุณาเลือก PIN อื่น";
  }
  return null;
}
