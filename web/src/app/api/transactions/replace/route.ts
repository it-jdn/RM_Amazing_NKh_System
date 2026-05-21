import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  canEditIntakeSlip,
  editIntakeSlipDeniedMessage,
} from "@/lib/auth/intake-slip-permissions";
import { getTransactions, listIntakeSlips, replaceTransactionsByDateSupp } from "@/lib/services/data";
import type { TransactionInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const { date, suppCode, transactions } = body as {
      date: string;
      suppCode: string;
      transactions: TransactionInput[];
    };
    if (!date || !suppCode) return jsonError("ต้องระบุ date และ suppCode");

    const listed = await listIntakeSlips({ dateFrom: date, dateTo: date, suppCode });
    if (listed.slips.length > 0) {
      if (listed.slips.length > 1) {
        return jsonError("มีหลายใบรับสินค้าในวันนี้ — แก้ไขทีละใบในหน้ารายละเอียด", 400);
      }
      const slip = listed.slips[0]!;
      if (
        !canEditIntakeSlip(auth.session, {
          createdByUserId: slip.createdByUserId,
          txnDate: slip.date,
        })
      ) {
        return jsonError(editIntakeSlipDeniedMessage(), 403);
      }
    } else {
      const { rows } = await getTransactions({ dateFrom: date, dateTo: date, suppCode });
      const legacyRows = rows.filter((r) => !r.slipId);
      if (!legacyRows.length) return jsonError("ไม่พบข้อมูลรับสินค้า", 404);
      if (
        !canEditIntakeSlip(auth.session, {
          createdByUserId: legacyRows[0]?.savedByUserId ?? null,
          txnDate: date,
        })
      ) {
        return jsonError(editIntakeSlipDeniedMessage(), 403);
      }
    }

    const result = await replaceTransactionsByDateSupp(date, suppCode, transactions, {
      userId: auth.session.userId,
      displayName: auth.session.displayName,
    });
    if (!result.success) {
      return jsonError("message" in result && result.message ? result.message : "Error");
    }
    return jsonOk(result);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
