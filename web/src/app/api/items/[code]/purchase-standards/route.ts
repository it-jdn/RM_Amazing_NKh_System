import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { formatPostgresError } from "@/lib/db/postgres-error";
import { saveItemPurchaseStandards } from "@/lib/services/data";

type RouteCtx = { params: Promise<{ code: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireApiRole("/api/items");
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  const body = (await req.json()) as {
    standards?: Array<{
      mainUnitCode: string;
      subUnitCode: string;
      convertRate: number;
      isDefault: boolean;
      sortOrder?: number;
    }>;
  };

  try {
    const result = await saveItemPurchaseStandards(
      code,
      (body.standards || []).map((r, i) => ({
        mainUnitCode: String(r.mainUnitCode || ""),
        subUnitCode: String(r.subUnitCode || ""),
        convertRate: parseFloat(String(r.convertRate)) || 1,
        isDefault: r.isDefault === true,
        sortOrder: r.sortOrder ?? i,
      }))
    );
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(formatPostgresError(e), 500);
  }
}
