import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  canDeleteIntakeBatch,
  deleteIntakeBatchDeniedMessage,
} from "@/lib/auth/intake-permissions";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  canDeleteIntakeSlip,
  deleteIntakeSlipDeniedMessage,
} from "@/lib/auth/intake-slip-permissions";
import { deleteIntakeSlipById, deleteTransactionsByDateSupp, getIntakeSlipById } from "@/lib/services/data";

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const slipId = searchParams.get("slipId")?.trim();
    const date = searchParams.get("date")?.trim();
    const suppCode = searchParams.get("suppCode")?.trim();

    if (slipId) {
      const slipRes = await getIntakeSlipById(slipId);
      if (!slipRes.slip) return jsonError("ไม่พบใบรับสินค้า", 404);
      if (
        !canDeleteIntakeSlip(auth.session, {
          createdByUserId: slipRes.slip.createdByUserId,
          txnDate: slipRes.slip.date,
        })
      ) {
        return jsonError(deleteIntakeSlipDeniedMessage(auth.session.role), 403);
      }
      const result = await deleteIntakeSlipById(slipId);
      if (!result.success) return jsonError("ลบไม่สำเร็จ");
      return jsonOk({
        success: true,
        deleted: result.deleted,
        message:
          result.deleted > 0
            ? `ลบใบรับสินค้าสำเร็จ (${result.deleted} รายการ)`
            : "ไม่พบข้อมูลที่จะลบ",
      });
    }

    if (!date || !suppCode) {
      return jsonError("ต้องระบุ slipId หรือ date และ suppCode");
    }

    if (!canDeleteIntakeBatch(auth.session.role, date)) {
      return jsonError(deleteIntakeBatchDeniedMessage(auth.session.role), 403);
    }

    const result = await deleteTransactionsByDateSupp(date, suppCode);
    if (!result.success) {
      return jsonError("ลบไม่สำเร็จ");
    }

    const slipsRemoved = result.slipsRemoved ?? 0;
    const hadLines = result.deleted > 0;
    const hadSlipsOnly = !hadLines && slipsRemoved > 0;

    return jsonOk({
      success: true,
      deleted: result.deleted,
      slipsRemoved: slipsRemoved ?? 0,
      message: hadLines
        ? `ลบการรับสินค้าทั้งวันสำเร็จ (${result.deleted} รายการ)`
        : hadSlipsOnly
          ? `ลบใบรับสินค้าที่ค้างในสรุปวันนี้สำเร็จ (${slipsRemoved} ใบ)`
          : "ไม่พบข้อมูลที่จะลบ",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
