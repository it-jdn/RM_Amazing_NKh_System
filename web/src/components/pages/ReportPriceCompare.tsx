"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import { IconCheck, IconChevronDown, IconX } from "@/components/icons/AppIcons";
import { itemDisplayName, itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { pickLatestReceivedItemCodes } from "@/lib/reports/price-trend";
import { fmt, formatAppDate } from "@/lib/utils/format";
import type { Item, Supplier } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

const PRICE_LABEL_FONT = "600 11px var(--font-ui), system-ui, sans-serif";
const PRICE_LABEL_LINE_HEIGHT = 14;
const PRICE_LABEL_BASE_OFFSET = 8;
const PRICE_LABEL_MAX_TIERS = 6;

type PricePointLabel = {
  x: number;
  y: number;
  text: string;
  color: string;
  width: number;
  height: number;
  offsetY: number;
};

function priceLabelBox(label: PricePointLabel) {
  const bottom = label.y - label.offsetY;
  return {
    left: label.x - label.width / 2 - 2,
    right: label.x + label.width / 2 + 2,
    top: bottom - label.height - 2,
    bottom: bottom + 2,
  };
}

function priceLabelsOverlap(a: PricePointLabel, b: PricePointLabel) {
  const boxA = priceLabelBox(a);
  const boxB = priceLabelBox(b);
  return !(
    boxA.right < boxB.left ||
    boxA.left > boxB.right ||
    boxA.bottom < boxB.top ||
    boxA.top > boxB.bottom
  );
}

/** Stack labels vertically when values sit close together on the chart. */
function layoutPricePointLabels(labels: PricePointLabel[]) {
  const sorted = [...labels].sort((a, b) => a.x - b.x || a.y - b.y);
  const placed: PricePointLabel[] = [];

  for (const label of sorted) {
    let chosen = PRICE_LABEL_BASE_OFFSET;
    for (let tier = 0; tier < PRICE_LABEL_MAX_TIERS; tier++) {
      label.offsetY = PRICE_LABEL_BASE_OFFSET + tier * PRICE_LABEL_LINE_HEIGHT;
      if (!placed.some((other) => priceLabelsOverlap(label, other))) {
        chosen = label.offsetY;
        break;
      }
    }
    label.offsetY = chosen;
    placed.push(label);
  }
}

const pricePointLabelPlugin: Plugin<"line"> = {
  id: "pricePointLabel",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const labels: PricePointLabel[] = [];

    ctx.save();
    ctx.font = PRICE_LABEL_FONT;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      const color =
        typeof dataset.borderColor === "string" ? dataset.borderColor : "rgba(30,40,70,.85)";
      meta.data.forEach((point, index) => {
        const raw = dataset.data[index];
        const value = typeof raw === "number" ? raw : null;
        if (value == null || !Number.isFinite(value)) return;
        const text = `₩${fmt(value)}`;
        const width = ctx.measureText(text).width;
        labels.push({
          x: point.x,
          y: point.y,
          text,
          color,
          width,
          height: PRICE_LABEL_LINE_HEIGHT,
          offsetY: PRICE_LABEL_BASE_OFFSET,
        });
      });
    });

    layoutPricePointLabels(labels);

    for (const label of labels) {
      ctx.fillStyle = label.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label.text, label.x, label.y - label.offsetY);
    }

    ctx.restore();
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

const MAX_CHART_ITEMS = 5;

type CatalogPickerRow = {
  item: Item;
  intakeCount: number;
  latestDate: string | null;
};

function buildCatalogPickerRows(items: Item[], intakePoints: IntakePoint[]): CatalogPickerRow[] {
  const intakeCount = new Map<string, number>();
  const latestDate = new Map<string, string>();
  for (const p of intakePoints) {
    const code = p.itemCode.trim();
    if (!code) continue;
    intakeCount.set(code, (intakeCount.get(code) ?? 0) + 1);
    const prev = latestDate.get(code);
    if (!prev || p.date > prev) latestDate.set(code, p.date);
  }

  return items.map((item) => ({
    item,
    intakeCount: intakeCount.get(item.code) ?? 0,
    latestDate: latestDate.get(item.code) ?? null,
  }));
}

function sortCatalogPickerRows(a: CatalogPickerRow, b: CatalogPickerRow, locale: "th" | "en" | "kr") {
  if (a.intakeCount && !b.intakeCount) return -1;
  if (!a.intakeCount && b.intakeCount) return 1;
  if (a.latestDate && b.latestDate) {
    const byDate = b.latestDate.localeCompare(a.latestDate);
    if (byDate) return byDate;
  } else if (a.latestDate) return -1;
  else if (b.latestDate) return 1;
  return itemDisplayName(a.item, locale).localeCompare(itemDisplayName(b.item, locale), locale, {
    sensitivity: "base",
  });
}

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
  const listId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const [intakePoints, setIntakePoints] = useState<IntakePoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSearch("");
    setOpen(false);
  }, [props.dateFrom, props.dateTo, props.suppCode]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) filterInputRef.current?.focus();
  }, [open]);

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
        const latest = pickLatestReceivedItemCodes(points, MAX_CHART_ITEMS);
        setSelectedCodes(latest);
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

  const catalogRows = useMemo(
    () => buildCatalogPickerRows(props.items, intakePoints),
    [props.items, intakePoints]
  );

  const sortedCatalogRows = useMemo(
    () => [...catalogRows].sort((a, b) => sortCatalogPickerRows(a, b, locale)),
    [catalogRows, locale]
  );

  const filteredCatalogRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedCatalogRows;
    return sortedCatalogRows.filter(({ item }) => {
      const label = itemDisplayName(item, locale).toLowerCase();
      return label.includes(q) || item.code.toLowerCase().includes(q);
    });
  }, [sortedCatalogRows, search, locale]);

  const chartItems = useMemo(
    () =>
      selectedCodes.map((code, index) => {
        const points = intakePoints.filter((p) => p.itemCode === code);
        const snapshot = points.find((p) => p.itemNameTH)?.itemNameTH;
        const title = itemDisplayNameByCode(code, props.items, locale, snapshot);
        const unit = dominantUnit(points);
        return { code, title, unit, points, color: LINE_COLORS[index % LINE_COLORS.length] };
      }),
    [selectedCodes, intakePoints, props.items, locale]
  );

  const selectedSeries = chartItems;

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

  const mixedScale = useMemo(() => {
    const values = selectedSeries.flatMap((s) =>
      s.points.filter((p) => p.unitPrice > 0 && (p.mainUnit.trim() || "—") === s.unit).map((p) => p.unitPrice)
    );
    if (values.length < 2) return false;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min > 0 && max / min >= 8;
  }, [selectedSeries]);

  const atLimit = selectedCodes.length >= MAX_CHART_ITEMS;

  function toggleItem(code: string) {
    setSelectedCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_CHART_ITEMS) return prev;
      return [...prev, code];
    });
  }

  function removeItem(code: string) {
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
  }

  function colorForCode(code: string) {
    const index = selectedCodes.indexOf(code);
    return index >= 0 ? LINE_COLORS[index % LINE_COLORS.length] : LINE_COLORS[0];
  }

  function clearSelection() {
    setSelectedCodes(pickLatestReceivedItemCodes(intakePoints, MAX_CHART_ITEMS));
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
      ) : !props.items.length ? (
        <p className="empty">{t("report.noData")}</p>
      ) : (
        <>
          <div className="report-price-compare__controls">
            <label className="lbl" htmlFor="report-price-trend-dropdown">
              {t("report.priceTrendPicker")}
            </label>
            <div className="report-price-compare__row">
              <div
                ref={dropdownRef}
                className={`report-price-multiselect report-price-compare__dropdown${open ? " report-price-multiselect--open" : ""}`}
              >
                <button
                  type="button"
                  id="report-price-trend-dropdown"
                  className={`report-price-multiselect__trigger${open ? " report-price-multiselect__trigger--open" : ""}`}
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  aria-controls={open ? listId : undefined}
                  onClick={() => {
                    setOpen((prev) => {
                      if (prev) setSearch("");
                      return !prev;
                    });
                  }}
                >
                  <span
                    className={`report-price-multiselect__trigger-label${selectedCodes.length ? "" : " is-placeholder"}`}
                  >
                    {selectedCodes.length > 0
                      ? t("report.priceTrendSelected", {
                          n: String(selectedCodes.length),
                          max: String(MAX_CHART_ITEMS),
                        })
                      : t("report.priceTrendDropdownPlaceholder")}
                  </span>
                  <IconChevronDown className="report-price-multiselect__chev" size={16} aria-hidden />
                </button>

                {open ? (
                  <div className="report-price-multiselect__panel">
                    <input
                      ref={filterInputRef}
                      type="search"
                      className="report-price-multiselect__filter"
                      value={search}
                      placeholder={t("report.priceTrendFilter")}
                      autoComplete="off"
                      aria-label={t("report.priceTrendFilter")}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setOpen(false);
                          setSearch("");
                        }
                      }}
                    />
                    {filteredCatalogRows.length > 0 ? (
                      <ul
                        id={listId}
                        className="report-price-multiselect__list"
                        role="listbox"
                        aria-multiselectable="true"
                        aria-label={t("report.priceTrendPicker")}
                      >
                        {filteredCatalogRows.map(({ item, intakeCount }) => {
                          const checked = selectedCodes.includes(item.code);
                          const disabled = !checked && atLimit;
                          return (
                            <li key={item.code} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={checked}
                                className={`report-price-multiselect__option${checked ? " is-checked" : ""}`}
                                disabled={disabled}
                                title={disabled ? t("report.priceTrendMax") : undefined}
                                onClick={() => toggleItem(item.code)}
                              >
                                <span className="report-price-multiselect__check" aria-hidden>
                                  {checked ? <IconCheck size={12} /> : null}
                                </span>
                                <span className="report-price-multiselect__option-body">
                                  <span className="report-price-multiselect__option-label">
                                    {itemDisplayName(item, locale)}
                                  </span>
                                  <span className="report-price-multiselect__option-meta">
                                    {intakeCount > 0
                                      ? t("report.priceTrendSamples", { n: intakeCount })
                                      : t("report.priceTrendNoIntake")}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="report-price-multiselect__empty">{t("report.priceTrendNoMatch")}</p>
                    )}
                  </div>
                ) : null}
              </div>

              {selectedCodes.length > 0 ? (
                <button type="button" className="filter-clear" onClick={clearSelection}>
                  {t("report.priceTrendClear")}
                </button>
              ) : null}

              {selectedCodes.length > 0 ? (
                <div className="report-price-compare__pills">
                  {selectedCodes.map((code) => {
                    const row = catalogRows.find((x) => x.item.code === code);
                    const unit = dominantUnit(intakePoints.filter((p) => p.itemCode === code));
                    const unitLabel = unit && unit !== "—" ? ` (${unit})` : "";
                    const title = row
                      ? itemDisplayName(row.item, locale)
                      : itemDisplayNameByCode(code, props.items, locale);
                    return (
                      <span key={code} className="report-price-chip">
                        <span
                          className="report-price-chip__swatch"
                          style={{ background: colorForCode(code) }}
                          aria-hidden
                        />
                        <span className="report-price-chip__label">
                          {title}
                          {unitLabel}
                        </span>
                        <button
                          type="button"
                          className="report-price-chip__remove"
                          onClick={() => removeItem(code)}
                          aria-label={t("report.priceTrendRemove")}
                        >
                          <IconX size={14} aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {mixedScale ? (
            <p className="report-price-scale-hint">{t("report.priceTrendScaleHint")}</p>
          ) : null}

          {selectedCodes.length > 0 && chart ? (
            <div className="report-price-combined-chart">
              <Line
                data={chart}
                plugins={[pricePointLabelPlugin]}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  layout: { padding: { top: 36, right: 8 } },
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
          ) : selectedCodes.length === 0 ? (
            <p className="empty">{t("report.priceTrendSelect")}</p>
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
