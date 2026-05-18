import { parseISODateLocal } from "@/lib/utils/format";

/** ช่วงก่อนหน้าที่มีจำนวนวันเท่ากัน (รวมปลายทาง) */
export function previousPeriodRange(
  dateFrom: string,
  dateTo: string
): { dateFrom: string; dateTo: string } | null {
  const from = parseISODateLocal(dateFrom);
  const to = parseISODateLocal(dateTo);
  if (!from || !to || to < from) return null;
  const dayMs = 86400000;
  const days = Math.round((to.getTime() - from.getTime()) / dayMs) + 1;
  const prevTo = new Date(from.getTime() - dayMs);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * dayMs);
  return {
    dateFrom: prevFrom.toISOString().slice(0, 10),
    dateTo: prevTo.toISOString().slice(0, 10),
  };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
