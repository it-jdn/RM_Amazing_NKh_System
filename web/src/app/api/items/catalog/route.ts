import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { saveItemMaster } from "@/lib/services/data";

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("/api/items");
  if ("status" in auth) return auth;

  try {
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
    const result = await saveItemMaster({
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
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
