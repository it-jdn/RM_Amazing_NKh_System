import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getReportData } from "@/lib/services/data";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole("/api/reports");
  if ("status" in auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      suppCode: searchParams.get("suppCode") || undefined,
      itemCode: searchParams.get("itemCode") || undefined,
      categoryCode: searchParams.get("categoryCode") || undefined,
    };
    return jsonOk(await getReportData(filters));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
