"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import { fmt, formatAppDate, getAppDayOfWeekShort } from "@/lib/utils/format";

type Cell = {
  dayOfWeek: number;
  weekStart: string;
  totalPrice: number;
  count: number;
};

export function ReportHeatmap({ cells, title }: { cells: Cell[]; title: string }) {
  const { locale, t } = useLocale();

  const { weeks, maxVal, grid } = useMemo(() => {
    const weekSet = [...new Set(cells.map((c) => c.weekStart))].sort();
    const byKey = new Map(cells.map((c) => [`${c.weekStart}|${c.dayOfWeek}`, c]));
    let maxVal = 0;
    const grid: (Cell | null)[][] = weekSet.map((ws) =>
      [0, 1, 2, 3, 4, 5, 6].map((dow) => {
        const c = byKey.get(`${ws}|${dow}`) || null;
        if (c && c.totalPrice > maxVal) maxVal = c.totalPrice;
        return c;
      })
    );
    return { weeks: weekSet, maxVal, grid };
  }, [cells]);

  return (
    <div className="card">
      <div className="card-title">
        <span className="dot dot-green" />
        <span>{title}</span>
      </div>
      {!weeks.length ? (
        <p className="empty">{t("report.noData")}</p>
      ) : (
        <div className="report-heatmap-wrap">
          <table className="report-heatmap">
            <thead>
              <tr>
                <th />
                {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                  <th key={dow}>{getAppDayOfWeekShort(dow, locale)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((ws, wi) => (
                <tr key={ws}>
                  <th className="report-heatmap__week">{formatAppDate(ws, locale)}</th>
                  {grid[wi].map((cell, dow) => {
                    const v = cell?.totalPrice ?? 0;
                    const intensity = maxVal > 0 ? v / maxVal : 0;
                    return (
                      <td
                        key={dow}
                        className="report-heatmap__cell"
                        style={{
                          backgroundColor: `rgba(26,107,181,${0.08 + intensity * 0.72})`,
                        }}
                        title={
                          cell ? `₩${fmt(v)} · ${cell.count} ${t("report.lines")}` : undefined
                        }
                      >
                        {v > 0 ? `₩${fmt(v)}` : "—"}
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
