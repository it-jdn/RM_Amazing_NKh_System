"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import {
  addCalendarDaysISO,
  fmt,
  formatAppDate,
  formatAppDateRange,
  getAppDayOfWeekShort,
  parseISODateLocal,
  weekStartSunday,
} from "@/lib/utils/format";

type Cell = {
  dayOfWeek: number;
  weekStart: string;
  totalPrice: number;
  count: number;
};

const DOW_ORDER = [0, 1, 2, 3, 4, 5, 6] as const;

function enumerateWeekStarts(dateFrom: string, dateTo: string): string[] {
  const start = weekStartSunday(dateFrom);
  const end = weekStartSunday(dateTo);
  const weeks: string[] = [];
  for (let cur = start; cur <= end; cur = addCalendarDaysISO(cur, 7)) {
    weeks.push(cur);
  }
  return weeks;
}

function weekRowLabel(weekStart: string, locale: Parameters<typeof formatAppDateRange>[2]) {
  const weekEnd = addCalendarDaysISO(weekStart, 6);
  return formatAppDateRange(weekStart, weekEnd, locale);
}

export function ReportHeatmap({
  cells,
  title,
  dateFrom = "",
  dateTo = "",
}: {
  cells: Cell[];
  title: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { locale, t } = useLocale();

  const { weeks, maxVal, grid, dayDates } = useMemo(() => {
    const byKey = new Map(cells.map((c) => [`${c.weekStart}|${c.dayOfWeek}`, c]));

    const weeksFromData = [...new Set(cells.map((c) => c.weekStart))].sort();
    const weeks =
      dateFrom && dateTo ? enumerateWeekStarts(dateFrom, dateTo) : weeksFromData;

    let maxVal = 0;
    const grid: (Cell | null)[][] = weeks.map((ws) =>
      DOW_ORDER.map((dow) => {
        const c = byKey.get(`${ws}|${dow}`) || null;
        if (c && c.totalPrice > maxVal) maxVal = c.totalPrice;
        return c;
      })
    );

    const dayDates: string[][] = weeks.map((ws) =>
      DOW_ORDER.map((dow) => addCalendarDaysISO(ws, dow))
    );

    return { weeks, maxVal, grid, dayDates };
  }, [cells, dateFrom, dateTo]);

  const filterFrom = dateFrom ? parseISODateLocal(dateFrom) : null;
  const filterTo = dateTo ? parseISODateLocal(dateTo) : null;

  function inFilterRange(iso: string) {
    const d = parseISODateLocal(iso);
    if (!d) return true;
    if (filterFrom && d < filterFrom) return false;
    if (filterTo && d > filterTo) return false;
    return true;
  }

  return (
    <div className="card">
      <div className="card-title">
        <span className="dot dot-green" />
        <span>{title}</span>
      </div>
      <p className="hint report-heatmap__hint">{t("report.heatmapHint")}</p>
      {!weeks.length ? (
        <p className="empty">{t("report.noData")}</p>
      ) : (
        <div className="report-heatmap-wrap">
          <table className="report-heatmap">
            <thead>
              <tr>
                <th className="report-heatmap__corner">{t("report.heatmapWeekCol")}</th>
                {DOW_ORDER.map((dow) => (
                  <th key={dow} className="report-heatmap__dow-h">
                    {getAppDayOfWeekShort(dow, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((ws, wi) => (
                <tr key={ws}>
                  <th className="report-heatmap__week">{weekRowLabel(ws, locale)}</th>
                  {grid[wi].map((cell, colIdx) => {
                    const dow = DOW_ORDER[colIdx];
                    const dayISO = dayDates[wi][colIdx];
                    const inRange = inFilterRange(dayISO);
                    const v = inRange ? (cell?.totalPrice ?? 0) : 0;
                    const intensity = maxVal > 0 && inRange ? v / maxVal : 0;
                    const count = inRange ? (cell?.count ?? 0) : 0;
                    return (
                      <td
                        key={dow}
                        className={`report-heatmap__cell${inRange ? "" : " report-heatmap__cell--out"}`}
                        style={
                          inRange
                            ? {
                                backgroundColor: `rgba(26,107,181,${0.06 + intensity * 0.72})`,
                              }
                            : undefined
                        }
                        title={
                          inRange && cell
                            ? `${formatAppDate(dayISO, locale)} · ₩${fmt(v)} · ${count} ${t("report.lines")}`
                            : inRange
                              ? `${formatAppDate(dayISO, locale)} · ${t("report.heatmapEmpty")}`
                              : undefined
                        }
                      >
                        <span className="report-heatmap__cell-date">
                          {formatAppDate(dayISO, locale)}
                        </span>
                        <span className="report-heatmap__cell-val">
                          {inRange && v > 0 ? `₩${fmt(v)}` : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
