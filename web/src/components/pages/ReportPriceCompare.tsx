"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ChartData, Plugin } from "chart.js";
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { pickLatestReceivedItemCodes } from "@/lib/reports/price-trend";
import { fmt, formatAppDate } from "@/lib/utils/format";
import type { Item, Supplier } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

const pricePointLabelPlugin: Plugin<"line"> = {
  id: "pricePointLabel",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      const color =
        typeof dataset.borderColor === "string" ? dataset.borderColor : "rgba(30,40,70,.85)";
      meta.data.forEach((point, index) => {
        const raw = dataset.data[index];
        const value = typeof raw === "number" ? raw : null;
        if (value == null || !Number.isFinite(value)) return;
        ctx.save();
        ctx.font = "600 11px var(--font-ui), system-ui, sans-serif";
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`₩${fmt(value)}`, point.x, point.y - 8);
        ctx.restore();
      });
    });
  },
};

interface IntakePoint {
  date: string;
  suppCode: string;
  suppName?: string;
  itemCode: string;
  itemNameTH: string;
  qty: number;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  unitPrice: number;
  totalPrice: number;
}

const LINE_COLORS = [
  "rgba(26,107,181,.95)",
  "rgba(232,66,26,.95)",
  "rgba(76,140,74,.95)",
  "rgba(200,150,50,.95)",
  "rgba(140,120,90,.95)",
];

const LATEST_ITEM_COUNT = 5;

/** Prefer the purchase unit used most often for a stable line per product. */
function dominantUnit(points: IntakePoint[]): string {
  const counts = new Map<string, number>();
  for (const p of points) {
    if (p.unitPrice <= 0) continue;
    const u = p.mainUnit.trim() || "—";
    counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  let best = "—";
  let bestN = -1;
  for (const [u, n] of counts) {
    if (n > bestN) {
      best = u;
      bestN = n;
    }
  }
  return best;
}

function buildCombinedChart(
  series: { code: string; title: string; unit: string; points: IntakePoint[] }[],
  locale: "th" | "en" | "kr"
): ChartData<"line", (number | null)[], string> | null {
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.points.filter((p) => p.unitPrice > 0).map((p) => p.date)))
  ).sort();
  if (!allDates.length || !series.length) return null;

  const datasets = series.map((s, i) => {
    const byDate = new Map<string, number>();
    for (const p of s.points) {
      if (p.unitPrice <= 0) continue;
      const u = p.mainUnit.trim() || "—";
      if (u !== s.unit) continue;
      byDate.set(p.date, p.unitPrice);
    }
    const unitSuffix = s.unit && s.unit !== "—" ? ` (${s.unit})` : "";
    return {
      label: `${s.title}${unitSuffix}`,
      data: allDates.map((d) => byDate.get(d) ?? null),
      borderColor: LINE_COLORS[i % LINE_COLORS.length],
      backgroundColor: "transparent",
      pointRadius: 4,
      pointHoverRadius: 5,
      tension: 0.25,
      spanGaps: true,
    };
  });

  return {
    labels: allDates.map((d) => formatAppDate(d, locale)),
    datasets,
  };
}

export function ReportPriceCompare(props: {
  dateFrom: string;
  dateTo: string;
  suppCode: string;
  suppliers: Supplier[];
  items: Item[];
}) {
  const { locale, t } = useLocale();
  const [intakePoints, setIntakePoints] = useState<IntakePoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    const params = new URLSearchParams();
    if (props.dateFrom) params.set("dateFrom", props.dateFrom);
    if (props.dateTo) params.set("dateTo", props.dateTo);
    if (props.suppCode) params.set("suppCode", props.suppCode);

    apiGet<{
      success: boolean;
      intakePoints: IntakePoint[];
    }>(`/api/reports/price-history?${params}`)
      .then((d) => {
        if (cancelled) return;
        const points = d.success ? d.intakePoints ?? [] : [];
        setIntakePoints(points);
        // Default to the single latest item so the Y-axis is readable; expand via chips.
        const latest = pickLatestReceivedItemCodes(points, LATEST_ITEM_COUNT);
        setSelectedCodes(latest.slice(0, 1));
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIntakePoints([]);
        setSelectedCodes([]);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [props.dateFrom, props.dateTo, props.suppCode]);

  const latestItems = useMemo(() => {
    const codes = pickLatestReceivedItemCodes(intakePoints, LATEST_ITEM_COUNT);
    return codes.map((code, index) => {
      const points = intakePoints.filter((p) => p.itemCode === code);
      const snapshot = points.find((p) => p.itemNameTH)?.itemNameTH;
      const title = itemDisplayNameByCode(code, props.items, locale, snapshot);
      const unit = dominantUnit(points);
      return { code, title, unit, points, color: LINE_COLORS[index % LINE_COLORS.length] };
    });
  }, [intakePoints, props.items, locale]);

  const selectedSeries = useMemo(
    () => latestItems.filter((item) => selectedCodes.includes(item.code)),
    [latestItems, selectedCodes]
  );

  const chart = useMemo(
    () => buildCombinedChart(selectedSeries, locale),
    [selectedSeries, locale]
  );

  const detailRows = useMemo(() => {
    const set = new Set(selectedCodes);
    return [...intakePoints]
      .filter((p) => set.has(p.itemCode))
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.itemCode.localeCompare(b.itemCode) ||
          a.mainUnit.localeCompare(b.mainUnit)
      )
      .slice(0, 80);
  }, [intakePoints, selectedCodes]);

  const allSelected =
    latestItems.length > 0 && latestItems.every((item) => selectedCodes.includes(item.code));

  const mixedScale = useMemo(() => {
    const values = selectedSeries.flatMap((s) =>
      s.points.filter((p) => p.unitPrice > 0 && (p.mainUnit.trim() || "—") === s.unit).map((p) => p.unitPrice)
    );
    if (values.length < 2) return false;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min > 0 && max / min >= 8;
  }, [selectedSeries]);

  function selectAll() {
    setSelectedCodes(latestItems.map((item) => item.code));
  }

  function toggleItem(code: string) {
    setSelectedCodes((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length ? next : prev;
      }
      return [...prev, code];
    });
  }

  function shopLabel(code: string) {
    const s = props.suppliers.find((x) => x.code === code);
    return s ? supplierDisplayName(s, locale) : code;
  }

  return (
    <div className="card report-price-compare">
      <div className="card-title">
        <span className="dot dot-orange" />
        <span>{t("report.priceCompare")}</span>
      </div>
      <p className="admin-hint report-price-compare__hint">{t("report.priceTrendHint")}</p>

      {!loaded ? (
        <p className="empty">{t("report.loading")}</p>
      ) : !latestItems.length ? (
        <p className="empty">{t("report.noData")}</p>
      ) : (
        <>
          <div
            className="report-price-chips"
            role="group"
            aria-label={t("report.priceTrendItems")}
          >
            <button
              type="button"
              className={`report-price-chip report-price-chip--all${allSelected ? " is-active" : ""}`}
              aria-pressed={allSelected}
              onClick={selectAll}
            >
              {t("report.priceTrendAll")}
            </button>
            {latestItems.map((item) => {
              const on = selectedCodes.includes(item.code);
              const unitLabel = item.unit && item.unit !== "—" ? item.unit : "";
              return (
                <button
                  key={item.code}
                  type="button"
                  className={`report-price-chip${on ? " is-active" : ""}`}
                  aria-pressed={on}
                  title={unitLabel ? `${item.title} (${unitLabel})` : item.title}
                  onClick={() => toggleItem(item.code)}
                >
                  <span
                    className="report-price-chip__swatch"
                    style={{ background: item.color }}
                    aria-hidden
                  />
                  <span className="report-price-chip__label">{item.title}</span>
                  {unitLabel ? <span className="report-price-chip__unit">({unitLabel})</span> : null}
                </button>
              );
            })}
          </div>

          {mixedScale ? (
            <p className="report-price-scale-hint">{t("report.priceTrendScaleHint")}</p>
          ) : null}

          {chart ? (
            <div className="report-price-combined-chart">
              <Line
                data={chart}
                plugins={[pricePointLabelPlugin]}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  layout: { padding: { top: 18, right: 8 } },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const v = ctx.parsed.y;
                          if (v == null) return `${ctx.dataset.label ?? ""}: —`;
                          return `${ctx.dataset.label ?? ""}: ₩${fmt(v)}`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    },
                    y: {
                      beginAtZero: false,
                      grace: "12%",
                      ticks: { callback: (v) => "₩" + fmt(Number(v)) },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <p className="empty">{t("report.noData")}</p>
          )}
        </>
      )}

      {loaded && detailRows.length > 0 ? (
        <>
          <p className="lbl report-price-compare__table-lbl">{t("report.intakePrices")}</p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>{t("report.dateFrom")}</th>
                  <th>{t("report.shop")}</th>
                  <th>{t("report.item")}</th>
                  <th>{t("report.qty")}</th>
                  <th>{t("report.purchaseUnit")}</th>
                  <th>{t("report.unitPrice")}</th>
                  <th>{t("report.value")}</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.map((p, i) => (
                  <tr key={`${p.date}-${p.suppCode}-${p.itemCode}-${p.mainUnit}-${i}`}>
                    <td>{formatAppDate(p.date, locale)}</td>
                    <td>{shopLabel(p.suppCode)}</td>
                    <td>
                      <b>
                        {itemDisplayNameByCode(p.itemCode, props.items, locale, p.itemNameTH)}
                      </b>
                    </td>
                    <td>{fmt(p.qty)}</td>
                    <td>{p.mainUnit || "—"}</td>
                    <td className="gval">₩{fmt(p.unitPrice)}</td>
                    <td className="gval">₩{fmt(p.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
