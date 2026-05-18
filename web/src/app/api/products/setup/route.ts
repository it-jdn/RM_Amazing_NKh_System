import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { saveProductShopMappings } from "@/lib/services/data";

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("/api/products");
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const result = await saveProductShopMappings({
      itemCode: body.itemCode,
      itemNameTH: body.itemNameTH,
      itemNameEN: body.itemNameEN,
      itemNameKR: body.itemNameKR,
      shops: body.shops || [],
      changedBy: auth.session.displayName,
    });
    if (!result.ok) return jsonError(result.message);
    return jsonOk({ success: true, message: result.message, itemCode: result.itemCode });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
