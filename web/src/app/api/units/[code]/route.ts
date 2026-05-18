import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { deleteMasterUnit, updateMasterUnit } from "@/lib/services/units";

type RouteCtx = { params: Promise<{ code: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  const body = (await req.json()) as {
    nameTH?: string;
    nameEN?: string;
    nameKR?: string;
    unitCode?: string;
    newUnitCode?: string;
  };

  try {
    const result = await updateMasterUnit(code, {
      nameTH: String(body.nameTH || ""),
      nameEN: body.nameEN,
      nameKR: body.nameKR,
      newUnitCode: body.newUnitCode ?? body.unitCode,
    });
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message, unit: result.unit });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  try {
    const result = await deleteMasterUnit(code);
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
