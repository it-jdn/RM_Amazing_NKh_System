import type { createAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/db/postgres-error";

type Supabase = ReturnType<typeof createAdminClient>;

let itemsHasCategoryCode: boolean | undefined;

/** ตรวจว่าตาราง items มีคอลัมน์ category_code (migration 010) หรือยัง */
export async function itemsTableHasCategoryCode(supabase: Supabase): Promise<boolean> {
  if (itemsHasCategoryCode !== undefined) return itemsHasCategoryCode;

  const { error } = await supabase.from("items").select("category_code").limit(1);
  if (!error) {
    itemsHasCategoryCode = true;
    return true;
  }
  if (isMissingColumnError(error, "category_code")) {
    itemsHasCategoryCode = false;
    return false;
  }
  itemsHasCategoryCode = true;
  return true;
}
