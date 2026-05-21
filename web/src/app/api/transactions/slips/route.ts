import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  canEditIntakeSlip,
} from "@/lib/auth/intake-slip-permissions";
import { getTransactions, listIntakeSlips } from "@/lib/services/data";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
    const dateTo = searchParams.get("dateTo")?.trim() || undefined;
    const suppCode = searchParams.get("suppCode")?.trim() || undefined;
    if (!dateFrom && !dateTo && !suppCode) {
      return jsonError("ต้องระบุ dateFrom/dateTo หรือ suppCode");
    }
    const listed = await listIntakeSlips({ dateFrom, dateTo, suppCode });
    const slips = listed.slips
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((slip, index) => ({
        ...slip,
        slipNo: index + 1,
        canEdit: canEditIntakeSlip(auth.session, {
          createdByUserId: slip.createdByUserId,
          txnDate: slip.date,
        }),
      }));

    let legacy: { canEdit: boolean; lineCount: number } | undefined;
    if (
      slips.length === 0 &&
      dateFrom &&
      dateTo &&
      suppCode &&
      dateFrom === dateTo
    ) {
      const { rows } = await getTransactions({ dateFrom, dateTo, suppCode });
      const legacyRows = rows.filter((r) => !r.slipId);
      if (legacyRows.length > 0) {
        const ownerId = legacyRows[0]?.savedByUserId ?? null;
        legacy = {
          canEdit: canEditIntakeSlip(auth.session, {
            createdByUserId: ownerId,
            txnDate: dateFrom,
          }),
          lineCount: legacyRows.length,
        };
      }
    }

    return jsonOk({ success: true, slips, legacy });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
