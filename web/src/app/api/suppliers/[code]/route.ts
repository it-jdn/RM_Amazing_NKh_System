import { NextRequest } from "next/server";
import { requireAdmin, requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { deleteSupplier, updateSupplier } from "@/lib/services/data";

type RouteCtx = { params: Promise<{ code: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireApiRole("/api/suppliers");
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  const body = (await req.json()) as {
    suppCode?: string;
    suppNameTH?: string;
    suppNameEN?: string;
    suppNameKR?: string;
    suppBusinessRegNo?: string;
    active?: boolean;
  };

  const isAdmin = auth.session.role === "admin";
  if (body.suppCode !== undefined && !isAdmin) {
    return jsonError("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้รหัสร้านได้", 403);
  }
  if (body.active !== undefined && !isAdmin) {
    return jsonError("เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนสถานะร้านได้", 403);
  }

  try {
    const result = await updateSupplier(code, {
      suppCode: isAdmin ? body.suppCode : undefined,
      nameTH: String(body.suppNameTH || ""),
      nameEN: body.suppNameEN,
      nameKR: body.suppNameKR,
      businessRegNo: body.suppBusinessRegNo,
      active: isAdmin ? body.active : undefined,
    });
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message, code: result.code });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  const { code } = await ctx.params;
  try {
    const result = await deleteSupplier(code);
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
