"use client";

import type { ReactNode } from "react";

function parseTrend(sub?: string): "up" | "down" | "neutral" | null {
  if (!sub) return null;
  const m = sub.match(/[+-]?\d+(\.\d+)?%/);
  if (!m) return "neutral";
  const n = parseFloat(m[0]);
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "neutral";
}

export function ReportKpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  const trend = parseTrend(sub);
  return (
    <article
      className={`report-kpi-card${highlight ? " report-kpi-card--highlight" : ""}`}
    >
      <span className="report-kpi-card__label">{label}</span>
      <span className="report-kpi-card__value">{value}</span>
      {sub ? (
        <span
          className={`report-kpi-card__sub${
            trend === "up"
              ? " report-kpi-card__sub--up"
              : trend === "down"
                ? " report-kpi-card__sub--down"
                : ""
          }`}
        >
          {sub}
        </span>
      ) : null}
    </article>
  );
}

export function ReportKpiGrid({ children }: { children: ReactNode }) {
  return <div className="report-kpi-grid">{children}</div>;
}
