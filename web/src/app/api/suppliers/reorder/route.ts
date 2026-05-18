import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { reorderSuppliers } from "@/lib/services/data";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  try {
    const body = (await req.json()) as { codes?: string[] };
    const codes = Array.isArray(body.codes) ? body.codes : [];
    const result = await reorderSuppliers(codes);
    if (!result.ok) return jsonError(result.message, 400);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
