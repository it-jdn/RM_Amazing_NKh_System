import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  canDeleteIntakeBatch,
  deleteIntakeBatchDeniedMessage,
} from "@/lib/auth/intake-permissions";
import { jsonError, jsonOk } from "@/lib/api/response";
import { deleteTransactionsByDateSupp } from "@/lib/services/data";

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date")?.trim();
    const suppCode = searchParams.get("suppCode")?.trim();

    if (!date || !suppCode) {
      return jsonError("ต้องระบุ date และ suppCode");
    }

    if (!canDeleteIntakeBatch(auth.session.role, date)) {
      return jsonError(deleteIntakeBatchDeniedMessage(auth.session.role), 403);
    }

    const result = await deleteTransactionsByDateSupp(date, suppCode);
    if (!result.success) {
      return jsonError("ลบไม่สำเร็จ");
    }

    return jsonOk({
      success: true,
      deleted: result.deleted,
      message:
        result.deleted > 0
          ? `ลบการรับของทั้งวันสำเร็จ (${result.deleted} รายการ)`
          : "ไม่พบข้อมูลที่จะลบ",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
