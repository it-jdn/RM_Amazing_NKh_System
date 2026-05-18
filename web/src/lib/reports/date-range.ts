import type { ReportByDate } from "@/lib/reports/aggregate";

/** Earliest and latest txn dates in aggregated report rows (byDate is sorted ascending). */
export function reportDataDateRange(
  byDate: ReportByDate[]
): { dateFrom: string; dateTo: string } | null {
  if (!byDate.length) return null;
  return { dateFrom: byDate[0].date, dateTo: byDate[byDate.length - 1].date };
}
