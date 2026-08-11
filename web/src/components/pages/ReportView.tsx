"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ScriptableContext,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { useAppData } from "@/context/AppDataContext";
import { useLocale } from "@/context/LocaleContext";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { supplierDisplayName, supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import { apiGet } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { fmt, formatAppDate, histDatePresetRange } from "@/lib/utils/format";
import { downloadExcelTable } from "@/lib/reports/export-excel";
import { ReportChartsFold } from "@/components/reports/ReportChartsFold";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportItemCumulativeChart } from "@/components/reports/ReportItemCumulativeChart";
import { ReportKpiCard, ReportKpiGrid } from "@/components/reports/ReportKpiGrid";
import { ReportTableSection } from "@/components/reports/ReportTableSection";
import { ReportTablePager, useReportTablePaging } from "@/components/reports/ReportTablePager";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

interface ReportData {
  success: boolean;
  dataDateRange?: { dateFrom: string; dateTo: string } | null;
  summary: {
    totalCost: number;
    totalTrans: number;
    avgDailyCost: number;
    daysWithActivity: number;
    distinctItems: number;
    distinctSuppliers: number;
    totalQty: number;
    avgPriceVariancePct: number | null;
  };
  previousPeriod?: {
    summary: { totalCost: number; totalTrans: number };
    changePct: { totalCost: number | null; totalTrans: number | null };
  } | null;
  byCategory: {
    categoryCode: string;
    categoryNameTH: string;
    totalPrice: number;
    count: number;
    distinctItems: number;
    sharePct: number;
  }[];
  itemCategories?: {
    code: string;
    nameTH: string;
    nameEN: string;
    nameKR: string;
    sortOrder: number;
  }[];
  byItem: {
    itemCode: string;
    itemName: string;
    categoryCode: string;
    categoryNameTH: string;
    qty: number;
    count: number;
    totalPrice: number;
    sharePct: number;
  }[];
  bySupp: {
    suppCode: string;
    suppName: string;
    totalPrice: number;
    count: number;
    sharePct: number;
  }[];
  byDate: { date: string; totalPrice: number; totalQty: number; count: number }[];
  cumulativeByDate: { date: string; cumulative: number }[];
  topItemsByValue: ReportData["byItem"];
  topItemsByQty: ReportData["byItem"];
  priceVarianceByMonth: { month: string; avgVariancePct: number; sampleCount: number }[];
  rows: {
    no?: number;
    date: string;
    suppName: string;
    suppCode: string;
    itemCode: string;
    itemNameTH: string;
    qty: number;
    mainUnit: string;
    totalPrice: number;
  }[];
  pagination: { page: number; pageSize: number; totalRows: number; totalPages: number };
}

type ItemSortKey = "category" | "qty" | "count" | "sharePct" | "totalPrice";
type DetailSortKey = "date" | "shop" | "item" | "qty" | "totalPrice";

function SortTh<T extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: T;
  sortKey: T;
  sortDir: "asc" | "desc";
  onSort: (column: T) => void;
}) {
  const active = sortKey === column;
  return (
    <th>
      <button
        type="button"
        className={`admin-table-sort${active ? ` admin-table-sort--active admin-table-sort--${sortDir}` : ""}`}
        onClick={() => onSort(column)}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{label}</span>
        <span className="admin-table-sort__icon" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function wonTicks(v: string | number) {
  return "₩" + fmt(Number(v));
}

function verticalGradient(
  context: ScriptableContext<"line">,
  colorTop: string,
  colorBottom: string
) {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return colorBottom;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  return gradient;
}

const CUMULATIVE_LABEL_MAX_COUNT = 10;

const cumulativeValueLabelPlugin = {
  id: "cumulativeValueLabel",
  afterDatasetsDraw(chart: ChartJS) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      const lastIndex = meta.data.length - 1;
      const step = Math.max(1, Math.ceil(meta.data.length / CUMULATIVE_LABEL_MAX_COUNT));
      meta.data.forEach((point, index) => {
        if (index % step !== 0 && index !== lastIndex) return;
        const value = dataset.data[index];
        if (value == null) return;
        ctx.save();
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.fillStyle = "#2e7d32";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(wonTicks(Number(value)), point.x, point.y - 6);
        ctx.restore();
      });
    });
  },
};

const CATEGORY_CHART_COLORS = [
  "rgba(255,66,26,.75)",
  "rgba(26,107,181,.75)",
  "rgba(76,140,74,.75)",
  "rgba(120,90,180,.75)",
  "rgba(200,150,50,.75)",
  "rgba(220,100,140,.75)",
  "rgba(60,160,160,.75)",
  "rgba(140,120,90,.75)",
];

export function ReportView() {
  const { suppliers, items, itemCategories: categoriesFromApi } = useAppData();
  const itemCategories = categoriesFromApi.length ? categoriesFromApi : FALLBACK_ITEM_CATEGORIES;
  const { locale, t } = useLocale();
  const toast = useToast();
  const [rFrom, setRFrom] = useState(() => histDatePresetRange("thisMonth").from);
  const [rTo, setRTo] = useState(() => histDatePresetRange("thisMonth").to);
  const [rSupp, setRSupp] = useState("");
  const [rItem, setRItem] = useState("");
  const [rCategory, setRCategory] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [chartRows, setChartRows] = useState<ReportData["rows"]>([]);
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState("thisMonth");
  const [categoryChartType, setCategoryChartType] = useState<"doughnut" | "bar">("doughnut");

  const categoryPaging = useReportTablePaging(data?.byCategory.length ?? 0);
  const itemPaging = useReportTablePaging(data?.byItem.length ?? 0);
  const detailPaging = useReportTablePaging(data?.rows.length ?? 0);

  const reportCategories =
    data?.itemCategories?.length ? data.itemCategories : itemCategories;

  const categoryLabel = useCallback(
    (categoryCode: string, fallbackTH: string) => {
      const cat = reportCategories.find((c) => c.code === categoryCode);
      return cat ? itemCategoryDisplayName(cat, locale) : fallbackTH;
    },
    [reportCategories, locale]
  );

  const itemName = useCallback(
    (itemCode: string, snapshot?: string) =>
      itemDisplayNameByCode(itemCode, items, locale, snapshot),
    [items, locale]
  );

  const shopName = useCallback(
    (suppCode: string, snapshot?: string) =>
      supplierDisplayNameByCode(suppCode, suppliers, locale, snapshot),
    [suppliers, locale]
  );

  const excelRange = rFrom && rTo ? `${rFrom}_${rTo}` : "all";

  const categoryTableTotals = useMemo(() => {
    if (!data?.byCategory.length) return null;
    return data.byCategory.reduce(
      (acc, row) => ({
        distinctItems: acc.distinctItems + row.distinctItems,
        count: acc.count + row.count,
        totalPrice: acc.totalPrice + row.totalPrice,
      }),
      { distinctItems: 0, count: 0, totalPrice: 0 }
    );
  }, [data?.byCategory]);

  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>("totalPrice");
  const [itemSortDir, setItemSortDir] = useState<"asc" | "desc">("desc");

  const handleItemSort = useCallback(
    (column: ItemSortKey) => {
      if (itemSortKey === column) {
        setItemSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setItemSortKey(column);
        setItemSortDir("asc");
      }
      itemPaging.setPage(1);
    },
    [itemSortKey, itemPaging]
  );

  const sortedByItem = useMemo(() => {
    if (!data?.byItem.length) return [];
    const dir = itemSortDir === "asc" ? 1 : -1;
    return [...data.byItem].sort((a, b) => {
      if (itemSortKey === "category") {
        return categoryLabel(a.categoryCode, a.categoryNameTH).localeCompare(
          categoryLabel(b.categoryCode, b.categoryNameTH),
          locale
        ) * dir;
      }
      return (a[itemSortKey] - b[itemSortKey]) * dir;
    });
  }, [data?.byItem, itemSortKey, itemSortDir, categoryLabel, locale]);

  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey>("date");
  const [detailSortDir, setDetailSortDir] = useState<"asc" | "desc">("desc");

  const handleDetailSort = useCallback(
    (column: DetailSortKey) => {
      if (detailSortKey === column) {
        setDetailSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setDetailSortKey(column);
        setDetailSortDir("asc");
      }
      detailPaging.setPage(1);
    },
    [detailSortKey, detailPaging]
  );

  const sortedDetailRows = useMemo(() => {
    if (!data?.rows.length) return [];
    const dir = detailSortDir === "asc" ? 1 : -1;
    return [...data.rows].sort((a, b) => {
      switch (detailSortKey) {
        case "date":
          return a.date.localeCompare(b.date) * dir;
        case "shop":
          return shopName(a.suppCode, a.suppName).localeCompare(
            shopName(b.suppCode, b.suppName),
            locale
          ) * dir;
        case "item":
          return itemName(a.itemCode, a.itemNameTH).localeCompare(
            itemName(b.itemCode, b.itemNameTH),
            locale
          ) * dir;
        case "qty":
          return (a.qty - b.qty) * dir;
        case "totalPrice":
          return (a.totalPrice - b.totalPrice) * dir;
        default:
          return 0;
      }
    });
  }, [data?.rows, detailSortKey, detailSortDir, shopName, itemName, locale]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const base = new URLSearchParams();
      if (rFrom) base.set("dateFrom", rFrom);
      if (rTo) base.set("dateTo", rTo);
      if (rSupp) base.set("suppCode", rSupp);
      if (rCategory) base.set("categoryCode", rCategory);
      base.set("page", "1");
      base.set("pageSize", "100000");

      const params = new URLSearchParams(base);
      if (rItem) params.set("itemCode", rItem);

      const [d, chartD] = await Promise.all([
        apiGet<ReportData>(`/api/reports?${params}`),
        apiGet<ReportData>(`/api/reports?${base}`),
      ]);
      if (!d.success) {
        toast(t("report.loadError"));
        return;
      }
      setData(d);
      setChartRows(chartD.success ? chartD.rows : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("report.loadError"));
    } finally {
      setLoading(false);
    }
  }, [rFrom, rTo, rSupp, rItem, rCategory, t, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  function printReport() {
    window.print();
  }

  function exportCategoryExcel() {
    if (!data) return;
    const rowCol = t("admin.table.rowCol");
    downloadExcelTable(
      `report-by-category-${excelRange}.xlsx`,
      t("report.byCategory"),
      [
        rowCol,
        t("report.category"),
        t("report.categoryItems"),
        t("report.categoryTrans"),
        t("report.share"),
        t("report.value"),
      ],
      data.byCategory.map((row, i) => [
        i + 1,
        categoryLabel(row.categoryCode, row.categoryNameTH),
        row.distinctItems,
        row.count,
        `${row.sharePct.toFixed(1)}%`,
        row.totalPrice,
      ])
    );
  }

  function exportItemExcel() {
    if (!data) return;
    const rowCol = t("admin.table.rowCol");
    downloadExcelTable(
      `report-by-item-${excelRange}.xlsx`,
      t("report.byItem"),
      [
        rowCol,
        t("report.itemCode"),
        t("report.item"),
        t("report.category"),
        t("report.qty"),
        t("report.lines"),
        t("report.share"),
        t("report.value"),
      ],
      sortedByItem.map((x, i) => [
        i + 1,
        x.itemCode,
        itemName(x.itemCode, x.itemName),
        categoryLabel(x.categoryCode, x.categoryNameTH),
        x.qty,
        x.count,
        `${x.sharePct.toFixed(1)}%`,
        x.totalPrice,
      ])
    );
  }

  function exportDetailExcel() {
    if (!data) return;
    const rowCol = t("admin.table.rowCol");
    downloadExcelTable(
      `report-intake-detail-${excelRange}.xlsx`,
      t("report.latest"),
      [rowCol, t("intake.date"), t("report.shop"), t("report.item"), t("report.qty"), t("report.value")],
      sortedDetailRows.map((r, i) => [
        i + 1,
        r.date,
        shopName(r.suppCode, r.suppName),
        itemName(r.itemCode, r.itemNameTH),
        `${r.qty} ${r.mainUnit}`,
        r.totalPrice,
      ])
    );
  }

  const dailyLineData = data
    ? {
        labels: data.byDate.map((x) => formatAppDate(x.date, locale)),
        datasets: [
          {
            label: t("report.dailyTrend"),
            data: data.byDate.map((x) => x.totalPrice),
            borderColor: "rgba(26,107,181,.95)",
            backgroundColor: (ctx: ScriptableContext<"line">) =>
              verticalGradient(ctx, "rgba(26,107,181,.32)", "rgba(26,107,181,.02)"),
            fill: true,
            tension: 0.45,
            borderWidth: 2.5,
            borderCapStyle: "round" as const,
            borderJoinStyle: "round" as const,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointHitRadius: 14,
            pointBackgroundColor: "#fff",
            pointBorderColor: "rgba(26,107,181,.95)",
            pointBorderWidth: 2,
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "rgba(26,107,181,.95)",
            pointHoverBorderWidth: 2.5,
            yAxisID: "y",
          },
          ...(rItem
            ? [
                {
                  label: t("report.dailyQty"),
                  data: data.byDate.map((x) => x.totalQty),
                  borderColor: "rgba(232,66,26,.9)",
                  backgroundColor: "transparent",
                  borderDash: [4, 4],
                  tension: 0.45,
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  yAxisID: "y1",
                },
              ]
            : []),
        ],
      }
    : null;

  const cumulativeLineData = data
    ? {
        labels: data.cumulativeByDate.map((x) => formatAppDate(x.date, locale)),
        datasets: [
          {
            label: t("report.cumulative"),
            data: data.cumulativeByDate.map((x) => x.cumulative),
            borderColor: "rgba(76,140,74,.95)",
            backgroundColor: "rgba(76,140,74,.1)",
            fill: true,
            tension: 0.2,
          },
        ],
      }
    : null;

  const categoryDoughnut = data?.byCategory.length
    ? {
        labels: data.byCategory.map((row) => {
          const cat = reportCategories.find((c) => c.code === row.categoryCode);
          return cat ? itemCategoryDisplayName(cat, locale) : row.categoryNameTH;
        }),
        datasets: [
          {
            data: data.byCategory.map((x) => x.totalPrice),
            backgroundColor: data.byCategory.map(
              (_, i) => CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length]!
            ),
          },
        ],
      }
    : null;

  const categoryChartOptions = data?.byCategory.length
    ? {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        plugins: {
          legend: {
            position: "bottom" as const,
            labels: {
              boxWidth: 10,
              padding: 6,
              font: { size: 10 },
              generateLabels(chart: ChartJS) {
                const labels = chart.data.labels ?? [];
                const dataset = chart.data.datasets[0];
                if (!dataset) return [];
                const colors = dataset.backgroundColor as string[];
                return labels.map((label, i) => {
                  const row = data.byCategory[i];
                  if (!row) {
                    return { text: String(label), fillStyle: colors[i] ?? "#ccc", hidden: false, index: i };
                  }
                  const text = `${label} · ₩${fmt(row.totalPrice)} · ${row.sharePct.toFixed(1)}% · ${row.count} ${t("report.lines")}`;
                  return {
                    text,
                    fillStyle: colors[i % colors.length] ?? "#ccc",
                    strokeStyle: "transparent",
                    hidden: false,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx: { dataIndex: number }) {
                const row = data.byCategory[ctx.dataIndex];
                if (!row) return "";
                return [
                  `${t("report.value")}: ₩${fmt(row.totalPrice)}`,
                  `${t("report.share")}: ${row.sharePct.toFixed(1)}%`,
                  `${t("report.categoryTrans")}: ${row.count}`,
                ];
              },
            },
          },
        },
      }
    : null;

  const categoryBarData = data?.byCategory.length
    ? {
        labels: data.byCategory.map((row) => categoryLabel(row.categoryCode, row.categoryNameTH)),
        datasets: [
          {
            data: data.byCategory.map((x) => x.totalPrice),
            backgroundColor: data.byCategory.map(
              (_, i) => CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length]!
            ),
            borderRadius: 4,
          },
        ],
      }
    : null;

  const categoryBarOptions = data?.byCategory.length
    ? {
        indexAxis: "y" as const,
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(ctx: { dataIndex: number }) {
                const row = data.byCategory[ctx.dataIndex];
                if (!row) return "";
                return [
                  `${t("report.value")}: ₩${fmt(row.totalPrice)}`,
                  `${t("report.share")}: ${row.sharePct.toFixed(1)}%`,
                  `${t("report.categoryTrans")}: ${row.count}`,
                ];
              },
            },
          },
        },
        scales: { x: { ticks: { callback: wonTicks } } },
      }
    : null;

  const showCategoryChartCard: boolean = false;

  const suppBarData = data?.bySupp.length
    ? {
        labels: data.bySupp.map((s) => {
          const sup = suppliers.find((x) => x.code === s.suppCode);
          return sup ? supplierDisplayName(sup, locale) : s.suppName;
        }),
        datasets: [
          {
            label: t("report.value"),
            data: data.bySupp.map((x) => x.totalPrice),
            backgroundColor: "rgba(26,107,181,.45)",
            borderColor: "rgba(26,107,181,.9)",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }
    : null;

  const topValueBar = data?.topItemsByValue.length
    ? {
        labels: data.topItemsByValue.map((x) => itemName(x.itemCode, x.itemName)),
        datasets: [
          {
            data: data.topItemsByValue.map((x) => x.totalPrice),
            backgroundColor: "rgba(232,66,26,.45)",
            borderColor: "rgba(232,66,26,.85)",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }
    : null;

  const chartOpts = {
    responsive: true,
    plugins: { legend: { display: true, position: "top" as const } },
  };

  return (
    <div className="wrap report-page">
      {loading && (
        <div className="report-loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="report-loading-overlay__box">
            <span className="report-loading-overlay__spinner" aria-hidden />
            <span className="report-loading-overlay__text">{t("report.loading")}</span>
          </div>
        </div>
      )}
      <ReportFilters
        dateFrom={rFrom}
        dateTo={rTo}
        suppCode={rSupp}
        categoryCode={rCategory}
        itemCode={rItem}
        datePreset={datePreset}
        onDateFrom={setRFrom}
        onDateTo={setRTo}
        onSuppCode={setRSupp}
        onCategoryCode={setRCategory}
        onItemCode={setRItem}
        onDatePreset={setDatePreset}
        suppliers={suppliers}
        items={items}
        itemCategories={itemCategories}
        loading={loading}
        hasData={!!data}
        dataDateRange={data?.dataDateRange ?? null}
        onPrint={printReport}
      />

      {data && (
        <>
          <ReportKpiGrid>
            <ReportKpiCard
              label={t("report.totalCost")}
              value={`₩${fmt(data.summary.totalCost)}`}
            />
            <ReportKpiCard label={t("report.avgDaily")} value={`₩${fmt(data.summary.avgDailyCost)}`} />
            <ReportKpiCard
              label={t("report.distinctItems")}
              value={String(data.summary.distinctItems)}
            />
          </ReportKpiGrid>

          <p className="admin-hint report-unit-note">{t("report.unitNote")}</p>

          <ReportChartsFold>
          <div className="report-charts-grid">
            <div className="card">
              <div className="card-title">
                <span className="dot dot-purple" />
                <span>{t("report.dailyTrend")}</span>
              </div>
              {dailyLineData && (
                <Line
                  data={dailyLineData}
                  options={{
                    responsive: true,
                    interaction: { mode: "index" as const, intersect: false },
                    plugins: {
                      legend: rItem ? { display: true, position: "top" as const } : { display: false },
                      tooltip: {
                        backgroundColor: "rgba(15,30,60,.92)",
                        titleColor: "#fff",
                        bodyColor: "#fff",
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                          label(ctx: { dataset: { yAxisID?: string }; parsed: { y: number | null } }) {
                            const y = ctx.parsed.y ?? 0;
                            return ctx.dataset.yAxisID === "y1" ? fmt(y) : wonTicks(y);
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: "#5a6a99" },
                      },
                      y: {
                        position: "left",
                        grid: { color: "rgba(15,23,42,.06)" },
                        border: { display: false },
                        ticks: { callback: wonTicks, color: "#5a6a99" },
                      },
                      ...(rItem
                        ? {
                            y1: {
                              position: "right",
                              grid: { drawOnChartArea: false },
                              border: { display: false },
                              ticks: { callback: (v) => fmt(Number(v)) },
                            },
                          }
                        : {}),
                    },
                  }}
                />
              )}
            </div>

            <div className="card">
              <div className="card-title">
                <span className="dot dot-green" />
                <span>{t("report.cumulative")}</span>
              </div>
              {cumulativeLineData && (
                <Line
                  data={cumulativeLineData}
                  plugins={[cumulativeValueLabelPlugin]}
                  options={{
                    ...chartOpts,
                    layout: { padding: { top: 20 } },
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { callback: wonTicks } } },
                  }}
                />
              )}
            </div>
          </div>

          <div className="report-charts-grid report-charts-grid--3">
            {/* ซ่อนไว้ก่อน: การ์ดสรุปตามหมวดหมู่ (โดนัท/แท่ง) — ขยายพื้นที่ให้มูลค่าตามร้าน และ Top 10 มูลค่าแทน */}
            {showCategoryChartCard && categoryDoughnut && categoryChartOptions && (
              <div className="card report-category-chart-card">
                <div className="card-title report-category-chart-title">
                  <span className="report-category-chart-title__label">
                    <span className="dot dot-orange" />
                    <span>{t("report.byCategory")}</span>
                  </span>
                  <div className="report-chart-type-toggle" role="group" aria-label={t("report.chartType")}>
                    <button
                      type="button"
                      className={`report-chart-type-toggle__btn${categoryChartType === "doughnut" ? " active" : ""}`}
                      onClick={() => setCategoryChartType("doughnut")}
                      aria-pressed={categoryChartType === "doughnut"}
                    >
                      {t("report.chartTypeDoughnut")}
                    </button>
                    <button
                      type="button"
                      className={`report-chart-type-toggle__btn${categoryChartType === "bar" ? " active" : ""}`}
                      onClick={() => setCategoryChartType("bar")}
                      aria-pressed={categoryChartType === "bar"}
                    >
                      {t("report.chartTypeBar")}
                    </button>
                  </div>
                </div>
                <div className="report-category-chart-wrap">
                  {categoryChartType === "doughnut" ? (
                    <Doughnut data={categoryDoughnut} options={categoryChartOptions} />
                  ) : (
                    categoryBarData &&
                    categoryBarOptions && <Bar data={categoryBarData} options={categoryBarOptions} />
                  )}
                </div>
              </div>
            )}
            {suppBarData && (
              <div className="card">
                <div className="card-title">
                  <span className="dot dot-blue" />
                  <span>{t("report.byShop")}</span>
                </div>
                <Bar
                  data={suppBarData}
                  options={{
                    indexAxis: "y" as const,
                    plugins: { legend: { display: false } },
                    scales: { x: { ticks: { callback: wonTicks } } },
                  }}
                />
              </div>
            )}
            {topValueBar && (
              <div className="card">
                <div className="card-title">
                  <span className="dot dot-orange" />
                  <span>{t("report.topValue")}</span>
                </div>
                <Bar
                  data={topValueBar}
                  options={{
                    indexAxis: "y" as const,
                    plugins: { legend: { display: false } },
                    scales: { x: { ticks: { callback: wonTicks } } },
                  }}
                />
              </div>
            )}
          </div>

          {/* ซ่อนไว้ก่อน: ต้นทุนสะสมตามสินค้า */}
          {false && (
            <ReportItemCumulativeChart
              rows={chartRows}
              items={items}
              categoryCode={rCategory}
              dateFrom={rFrom}
              dateTo={rTo}
              datePreset={datePreset}
            />
          )}
          </ReportChartsFold>

          <ReportTableSection
            title={t("report.byCategory")}
            dot="orange"
            onExportExcel={exportCategoryExcel}
            exportDisabled={!data.byCategory.length}
          >
            <ReportTablePager
              totalRows={data.byCategory.length}
              pageSize={categoryPaging.pageSize}
              page={categoryPaging.page}
              totalPages={categoryPaging.totalPages}
              from={categoryPaging.from}
              to={categoryPaging.to}
              onPageSizeChange={categoryPaging.setPageSize}
              onPageChange={categoryPaging.setPage}
            />
            <div className="tbl-scroll tbl-scroll--cards">
              <table className="dtbl dtbl--cards">
                <thead>
                  <tr>
                    <th>{t("admin.table.rowCol")}</th>
                    <th>{t("report.category")}</th>
                    <th>{t("report.categoryItems")}</th>
                    <th>{t("report.categoryTrans")}</th>
                    <th>{t("report.share")}</th>
                    <th>{t("report.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.length ? (
                    data.byCategory
                      .slice(categoryPaging.offset, categoryPaging.offset + categoryPaging.limit)
                      .map((row, i) => (
                      <tr key={row.categoryCode}>
                        <td className="row-num" data-label={t("admin.table.rowCol")}>{categoryPaging.offset + i + 1}</td>
                        <td data-label={t("report.category")}>
                          <b>{categoryLabel(row.categoryCode, row.categoryNameTH)}</b>
                        </td>
                        <td data-label={t("report.categoryItems")}>{row.distinctItems}</td>
                        <td data-label={t("report.categoryTrans")}>{row.count}</td>
                        <td data-label={t("report.share")}>{row.sharePct.toFixed(1)}%</td>
                        <td className="gval" data-label={t("report.value")}>₩{fmt(row.totalPrice)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty">
                        {t("report.noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
                {categoryTableTotals ? (
                  <tfoot>
                    <tr className="dtbl-foot">
                      <td className="row-num" data-label={t("admin.table.rowCol")} />
                      <td data-label={t("report.category")}>
                        <b>{t("intake.slipDoc.totalShort")}</b>
                      </td>
                      <td data-label={t("report.categoryItems")}>
                        {categoryTableTotals.distinctItems}
                      </td>
                      <td data-label={t("report.categoryTrans")}>{categoryTableTotals.count}</td>
                      <td data-label={t("report.share")}>100.0%</td>
                      <td className="gval" data-label={t("report.value")}>
                        ₩{fmt(categoryTableTotals.totalPrice)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </ReportTableSection>

          <ReportTableSection
            title={t("report.byItem")}
            dot="blue"
            onExportExcel={exportItemExcel}
            exportDisabled={!data.byItem.length}
          >
            <ReportTablePager
              totalRows={data.byItem.length}
              pageSize={itemPaging.pageSize}
              page={itemPaging.page}
              totalPages={itemPaging.totalPages}
              from={itemPaging.from}
              to={itemPaging.to}
              onPageSizeChange={itemPaging.setPageSize}
              onPageChange={itemPaging.setPage}
            />
            <div className="tbl-scroll tbl-scroll--cards">
              <table className="dtbl dtbl--cards">
                <thead>
                  <tr>
                    <th>{t("admin.table.rowCol")}</th>
                    <th>{t("report.itemCode")}</th>
                    <th>{t("report.item")}</th>
                    <SortTh
                      label={t("report.category")}
                      column="category"
                      sortKey={itemSortKey}
                      sortDir={itemSortDir}
                      onSort={handleItemSort}
                    />
                    <SortTh
                      label={t("report.qty")}
                      column="qty"
                      sortKey={itemSortKey}
                      sortDir={itemSortDir}
                      onSort={handleItemSort}
                    />
                    <SortTh
                      label={t("report.lines")}
                      column="count"
                      sortKey={itemSortKey}
                      sortDir={itemSortDir}
                      onSort={handleItemSort}
                    />
                    <SortTh
                      label={t("report.share")}
                      column="sharePct"
                      sortKey={itemSortKey}
                      sortDir={itemSortDir}
                      onSort={handleItemSort}
                    />
                    <SortTh
                      label={t("report.value")}
                      column="totalPrice"
                      sortKey={itemSortKey}
                      sortDir={itemSortDir}
                      onSort={handleItemSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedByItem.length ? (
                    sortedByItem
                      .slice(itemPaging.offset, itemPaging.offset + itemPaging.limit)
                      .map((x, i) => (
                      <tr key={x.itemCode}>
                        <td className="row-num" data-label={t("admin.table.rowCol")}>{itemPaging.offset + i + 1}</td>
                        <td data-label={t("report.itemCode")}>{x.itemCode}</td>
                        <td data-label={t("report.item")}>
                          <b>{itemName(x.itemCode, x.itemName)}</b>
                        </td>
                        <td data-label={t("report.category")}>
                          {categoryLabel(x.categoryCode, x.categoryNameTH)}
                        </td>
                        <td className="gval" data-label={t("report.qty")}>{fmt(x.qty)}</td>
                        <td data-label={t("report.lines")}>{x.count}</td>
                        <td data-label={t("report.share")}>{x.sharePct.toFixed(1)}%</td>
                        <td className="gval" data-label={t("report.value")}>₩{fmt(x.totalPrice)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="empty">
                        {t("report.noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReportTableSection>

          <ReportTableSection
            title={t("report.latest")}
            dot="green"
            onExportExcel={exportDetailExcel}
            exportDisabled={!data.rows.length}
          >
            <ReportTablePager
              totalRows={data.rows.length}
              pageSize={detailPaging.pageSize}
              page={detailPaging.page}
              totalPages={detailPaging.totalPages}
              from={detailPaging.from}
              to={detailPaging.to}
              onPageSizeChange={detailPaging.setPageSize}
              onPageChange={detailPaging.setPage}
            />
            <div className="tbl-scroll tbl-scroll--cards">
              <table className="dtbl dtbl--cards">
                <thead>
                  <tr>
                    <th>{t("admin.table.rowCol")}</th>
                    <SortTh
                      label={t("intake.date")}
                      column="date"
                      sortKey={detailSortKey}
                      sortDir={detailSortDir}
                      onSort={handleDetailSort}
                    />
                    <SortTh
                      label={t("report.shop")}
                      column="shop"
                      sortKey={detailSortKey}
                      sortDir={detailSortDir}
                      onSort={handleDetailSort}
                    />
                    <SortTh
                      label={t("report.item")}
                      column="item"
                      sortKey={detailSortKey}
                      sortDir={detailSortDir}
                      onSort={handleDetailSort}
                    />
                    <SortTh
                      label={t("report.qty")}
                      column="qty"
                      sortKey={detailSortKey}
                      sortDir={detailSortDir}
                      onSort={handleDetailSort}
                    />
                    <SortTh
                      label={t("report.value")}
                      column="totalPrice"
                      sortKey={detailSortKey}
                      sortDir={detailSortDir}
                      onSort={handleDetailSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedDetailRows.length ? (
                    sortedDetailRows
                      .slice(detailPaging.offset, detailPaging.offset + detailPaging.limit)
                      .map((r, i) => (
                      <tr key={`${r.date}-${r.suppCode}-${r.itemNameTH}-${detailPaging.offset + i}`}>
                        <td className="row-num" data-label={t("admin.table.rowCol")}>{detailPaging.offset + i + 1}</td>
                        <td data-label={t("intake.date")}>{formatAppDate(r.date, locale)}</td>
                        <td data-label={t("report.shop")}>{shopName(r.suppCode, r.suppName)}</td>
                        <td data-label={t("report.item")}>
                          <b>{itemName(r.itemCode, r.itemNameTH)}</b>
                        </td>
                        <td
                          data-label={t("report.qty")}
                          style={{ fontFamily: "IBM Plex Mono, monospace" }}
                        >
                          {fmt(r.qty)} {r.mainUnit}
                        </td>
                        <td className="gval" data-label={t("report.value")}>₩{fmt(r.totalPrice)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty">
                        {t("report.noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReportTableSection>
        </>
      )}
    </div>
  );
}
