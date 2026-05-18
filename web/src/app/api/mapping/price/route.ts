import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { updateUnitPrice } from "@/lib/services/data";

export async function PATCH(req: NextRequest) {
  const auth = await requireApiRole("/api/mapping");
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const result = await updateUnitPrice(
      body.suppCode,
      body.itemCode,
      parseFloat(String(body.newPrice)) || 0,
      { displayName: auth.session.displayName }
    );
    if (!result.ok) return jsonError(result.message);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
