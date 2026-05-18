import { NextRequest } from "next/server";
import { requireAdmin, requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { formatPostgresError } from "@/lib/db/postgres-error";
import { deleteItem, saveItemMaster } from "@/lib/services/data";

type RouteCtx = { params: Promise<{ code: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireApiRole("/api/items");
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  const body = (await req.json()) as {
    itemCode?: string;
    itemNameTH?: string;
    itemNameEN?: string;
    itemNameKR?: string;
    mainUnitCode?: string;
    subUnitCode?: string;
    convertRate?: number | string;
    categoryCode?: string;
  };

  try {
    const result = await saveItemMaster({
      currentItemCode: code,
      itemCode: body.itemCode,
      itemNameTH: String(body.itemNameTH || ""),
      itemNameEN: body.itemNameEN,
      itemNameKR: body.itemNameKR,
      mainUnitCode: String(body.mainUnitCode || ""),
      subUnitCode: String(body.subUnitCode || ""),
      convertRate: body.convertRate,
      categoryCode: body.categoryCode,
      changedBy: auth.session.displayName,
    });
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message, itemCode: result.itemCode });
  } catch (e) {
    return jsonError(formatPostgresError(e), 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  try {
    const result = await deleteItem(code);
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(formatPostgresError(e), 500);
  }
}
