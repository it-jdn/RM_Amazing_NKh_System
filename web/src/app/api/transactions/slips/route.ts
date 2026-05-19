import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { listIntakeSlips } from "@/lib/services/data";

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
    return jsonOk(await listIntakeSlips({ dateFrom, dateTo, suppCode }));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
