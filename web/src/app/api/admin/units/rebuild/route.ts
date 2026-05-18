import { requireAdmin } from "@/lib/auth/api";
import { jsonOk, jsonError } from "@/lib/api/response";
import { rebuildUnitsFromTransactions } from "@/lib/services/units";

export async function POST() {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  try {
    const result = await rebuildUnitsFromTransactions();
    return jsonOk({
      success: true,
      message: `✅ สร้าง/อัปเดตหน่วย ${result.unitsUpserted} รายการ, คู่หน่วย ${result.pairsUpserted} รายการ`,
      ...result,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
