import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getReportData, reportRowsToCsv } from "@/lib/services/data";

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
      page: parseInt(searchParams.get("page") || "1", 10) || 1,
      pageSize: parseInt(searchParams.get("pageSize") || "50", 10) || 50,
    };

    if (searchParams.get("format") === "csv") {
      const data = await getReportData({ ...filters, page: 1, pageSize: 10000 });
      const csv = reportRowsToCsv(data.rows);
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${filters.dateFrom || "all"}-${filters.dateTo || "all"}.csv"`,
        },
      });
    }

    return jsonOk(await getReportData(filters));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
