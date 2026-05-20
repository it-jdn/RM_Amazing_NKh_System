import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import {
  canDeleteIntakeSlip,
  canEditIntakeSlip,
  deleteIntakeSlipDeniedMessage,
  editIntakeSlipDeniedMessage,
} from "@/lib/auth/intake-slip-permissions";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  deleteIntakeSlipById,
  getIntakeSlipById,
  getTransactionRowsForSlip,
} from "@/lib/services/data";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const { id } = await ctx.params;
    const slipRes = await getIntakeSlipById(id);
    if (!slipRes.slip) return jsonError("ไม่พบใบรับสินค้า", 404);
    const rows = await getTransactionRowsForSlip(id);
    const canEdit = canEditIntakeSlip(auth.session, {
      createdByUserId: slipRes.slip.createdByUserId,
      txnDate: slipRes.slip.date,
    });
    return jsonOk({ success: true, slip: slipRes.slip, rows, canEdit });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const { id } = await ctx.params;
    const slipRes = await getIntakeSlipById(id);
    if (!slipRes.slip) return jsonError("ไม่พบใบรับสินค้า", 404);
    if (
      !canDeleteIntakeSlip(auth.session, {
        createdByUserId: slipRes.slip.createdByUserId,
        txnDate: slipRes.slip.date,
      })
    ) {
      return jsonError(deleteIntakeSlipDeniedMessage(auth.session.role), 403);
    }
    const result = await deleteIntakeSlipById(id);
    return jsonOk({
      success: true,
      deleted: result.deleted,
      message:
        result.deleted > 0
          ? `ลบใบรับสินค้าสำเร็จ (${result.deleted} รายการ)`
          : "ไม่พบข้อมูลที่จะลบ",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function PATCH(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const { id } = await ctx.params;
    const slipRes = await getIntakeSlipById(id);
    if (!slipRes.slip) return jsonError("ไม่พบใบรับสินค้า", 404);
    if (
      !canEditIntakeSlip(auth.session, {
        createdByUserId: slipRes.slip.createdByUserId,
        txnDate: slipRes.slip.date,
      })
    ) {
      return jsonError(editIntakeSlipDeniedMessage(), 403);
    }
    return jsonOk({ success: true, canEdit: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
