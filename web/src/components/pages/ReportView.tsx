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
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { useAppData } from "@/context/AppDataContext";
import { useLocale } from "@/context/LocaleContext";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { itemDisplayName, itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { supplierDisplayName, supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import type { MessageKey } from "@/lib/i18n/messages";
import { apiGet } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { fmt, formatAppDate, formatAppDateRange, histDatePresetRange } from "@/lib/utils/format";
import { downloadExcelTable } from "@/lib/reports/export-excel";
import { ReportChartsFold } from "@/components/reports/ReportChartsFold";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportItemCumulativeChart } from "@/components/reports/ReportItemCumulativeChart";
import { ReportKpiCard, ReportKpiGrid } from "@/components/reports/ReportKpiGrid";
import { ReportTableSection } from "@/components/reports/ReportTableSection";
import { ReportTablePager, useReportTablePaging } from "@/components/reports/ReportTablePager";
import { ReportPriceCompare } from "@/components/pages/ReportPriceCompare";

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

function wonTicks(v: string | number) {
  return "₩" + fmt(Number(v));
}

function formatVsPrev(
  pct: number | null | undefined,
  t: (key: MessageKey, params?: Record<string, string | number>) => string
) {
  if (pct == null || Number.isNaN(pct)) return undefined;
  const sign = pct > 0 ? "+" : "";
  return t("report.vsPrevPct", { pct: `${sign}${pct.toFixed(1)}` });
}

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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [datePreset, setDatePreset] = useState("thisMonth");

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

  const printSummary = useMemo(() => {
    const parts: string[] = [];
    const rangeFrom = data?.dataDateRange?.dateFrom;
    const rangeTo = data?.dataDateRange?.dateTo;
    if (datePreset === "all" && rangeFrom && rangeTo) {
      parts.push(`${formatAppDate(rangeFrom, locale)} – ${formatAppDate(rangeTo, locale)}`);
    } else if (rFrom && rTo) {
      parts.push(formatAppDateRange(rFrom, rTo, locale));
    }
    if (rSupp) {
      const shop = suppliers.find((s) => s.code === rSupp);
      parts.push(shop ? supplierDisplayName(shop, locale) : rSupp);
    }
    if (rCategory) {
      const cat = itemCategories.find((c) => c.code === rCategory);
      parts.push(cat ? itemCategoryDisplayName(cat, locale) : rCategory);
    }
    if (rItem) {
      const item = items.find((i) => i.code === rItem);
      parts.push(item ? itemDisplayName(item, locale) : rItem);
    }
    return parts.join(" · ");
  }, [
    data?.dataDateRange?.dateFrom,
    data?.dataDateRange?.dateTo,
    datePreset,
    itemCategories,
    items,
    locale,
    rCategory,
    rFrom,
    rItem,
    rSupp,
    rTo,
    suppliers,
  ]);

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
  }, [data]);

  const buildParams = useCallback(
    (includeItem: boolean) => {
      const params = new URLSearchParams();
      if (rFrom) params.set("dateFrom", rFrom);
      if (rTo) params.set("dateTo", rTo);
      if (rSupp) params.set("suppCode", rSupp);
      if (rCategory) params.set("categoryCode", rCategory);
      if (includeItem && rItem) params.set("itemCode", rItem);
      params.set("page", "1");
      params.set("pageSize", "100000");
      return params;
    },
    [rFrom, rTo, rSupp, rCategory, rItem]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const filteredParams = buildParams(true);
      const chartParams = buildParams(false);

      const filteredPromise = apiGet<ReportData>(`/api/reports?${filteredParams}`);
      const chartPromise = rItem
        ? apiGet<ReportData>(`/api/reports?${chartParams}`)
        : null;

      const [d, chartD] = await Promise.all([filteredPromise, chartPromise]);
      if (!d.success) {
        toast(t("report.loadError"));
        return;
      }
      setData(d);
      setChartRows(chartD?.success ? chartD.rows : d.rows);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("report.loadError"));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [buildParams, rItem, t, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  function resetFilters() {
    const range = histDatePresetRange("thisMonth");
    setDatePreset("thisMonth");
    setRFrom(range.from);
    setRTo(range.to);
    setRSupp("");
    setRCategory("");
    setRItem("");
  }

  function printReport() {
    window.print();
  }

  async function exportCsv() {
    try {
      const params = buildParams(true);
      params.set("format", "csv");
      const res = await fetch(`/api/reports?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(t("report.loadError"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${excelRange}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("report.loadError"));
    }
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
      [rowCol, t("report.item"), t("report.qty"), t("report.lines"), t("report.share"), t("report.value")],
      data.byItem.map((x, i) => [
        i + 1,
        itemName(x.itemCode, x.itemName),
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
      data.rows.map((r, i) => [
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
            backgroundColor: "rgba(26,107,181,.12)",
            fill: true,
            tension: 0.25,
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
                  tension: 0.25,
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

  const topQtyBar = data?.topItemsByQty.length
    ? {
        labels: data.topItemsByQty.map((x) => itemName(x.itemCode, x.itemName)),
        datasets: [
          {
            data: data.topItemsByQty.map((x) => x.qty),
            backgroundColor: "rgba(76,140,74,.45)",
            borderColor: "rgba(76,140,74,.85)",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }
    : null;

  const varianceLine = data?.priceVarianceByMonth.length
    ? {
        labels: data.priceVarianceByMonth.map((x) => x.month),
        datasets: [
          {
            label: t("report.varianceMonth"),
            data: data.priceVarianceByMonth.map((x) => x.avgVariancePct),
            borderColor: "rgba(120,90,180,.95)",
            backgroundColor: "rgba(120,90,180,.12)",
            fill: true,
            tension: 0.25,
          },
        ],
      }
    : null;

  const chartOpts = {
    responsive: true,
    plugins: { legend: { display: true, position: "top" as const } },
  };

  const hasRows = !!data && data.summary.totalTrans > 0;

  return (
    <div className="wrap report-page">
      <div className="report-print-header" aria-hidden>
        <h1>{t("report.title")}</h1>
        {printSummary ? <p>{printSummary}</p> : null}
      </div>

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
        onReset={resetFilters}
        onExportCsv={exportCsv}
        suppliers={suppliers}
        items={items}
        itemCategories={itemCategories}
        loading={loading}
        hasData={!!data && hasRows}
        dataDateRange={data?.dataDateRange ?? null}
        onPrint={printReport}
      />

      {loading && !data ? (
        <p className="report-status" role="status">
          {t("report.loading")}
        </p>
      ) : null}

      {hasLoaded && data && !hasRows ? (
        <div className="card report-empty" role="status">
          <p className="report-empty__title">{t("report.noData")}</p>
          <p className="report-empty__hint">{t("report.emptyHint")}</p>
        </div>
      ) : null}

      {data && hasRows && (
        <>
          <ReportKpiGrid>
            <ReportKpiCard
              highlight
              label={t("report.totalCost")}
              value={`₩${fmt(data.summary.totalCost)}`}
              sub={formatVsPrev(data.previousPeriod?.changePct.totalCost, t)}
            />
            <ReportKpiCard
              label={t("report.totalTrans")}
              value={String(data.summary.totalTrans)}
              sub={formatVsPrev(data.previousPeriod?.changePct.totalTrans, t)}
            />
            <ReportKpiCard label={t("report.avgDaily")} value={`₩${fmt(data.summary.avgDailyCost)}`} />
            <ReportKpiCard
              label={t("report.distinctItems")}
              value={String(data.summary.distinctItems)}
            />
            <ReportKpiCard
              label={t("report.distinctShops")}
              value={String(data.summary.distinctSuppliers)}
            />
            {data.summary.avgPriceVariancePct != null ? (
              <ReportKpiCard
                label={t("report.priceVariance")}
                value={`${data.summary.avgPriceVariancePct > 0 ? "+" : ""}${data.summary.avgPriceVariancePct.toFixed(1)}%`}
              />
            ) : null}
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
                    ...chartOpts,
                    scales: {
                      y: {
                        position: "left",
                        ticks: { callback: wonTicks },
                      },
                      ...(rItem
                        ? {
                            y1: {
                              position: "right",
                              grid: { drawOnChartArea: false },
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
                  options={{
                    ...chartOpts,
                    plugins: { legend: { display: false } },
                    scales: { y: { ticks: { callback: wonTicks } } },
                  }}
                />
              )}
            </div>
          </div>

          <div className="report-charts-grid report-charts-grid--3">
            {categoryDoughnut && categoryChartOptions && (
              <div className="card report-category-chart-card">
                <div className="card-title">
                  <span className="dot dot-orange" />
                  <span>{t("report.byCategory")}</span>
                </div>
                <div className="report-category-chart-wrap">
                  <Doughnut data={categoryDoughnut} options={categoryChartOptions} />
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

          <div className="report-charts-grid">
            {topQtyBar && (
              <div className="card">
                <div className="card-title">
                  <span className="dot dot-green" />
                  <span>{t("report.topQty")}</span>
                </div>
                <Bar
                  data={topQtyBar}
                  options={{
                    indexAxis: "y" as const,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { callback: (v) => fmt(Number(v)) } },
                    },
                  }}
                />
              </div>
            )}
            {varianceLine && (
              <div className="card">
                <div className="card-title">
                  <span className="dot dot-purple" />
                  <span>{t("report.varianceMonth")}</span>
                </div>
                <Line
                  data={varianceLine}
                  options={{
                    ...chartOpts,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        ticks: {
                          callback: (v) => `${Number(v).toFixed(0)}%`,
                        },
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>

          <ReportItemCumulativeChart
            rows={chartRows}
            items={items}
            categoryCode={rCategory}
            dateFrom={rFrom}
            dateTo={rTo}
            datePreset={datePreset}
          />
          </ReportChartsFold>

          {rItem ? (
            <ReportPriceCompare
              key={`${rFrom}|${rTo}|${rSupp}|${rItem}`}
              dateFrom={rFrom}
              dateTo={rTo}
              suppCode={rSupp}
              itemCode={rItem}
              active
              suppliers={suppliers}
              items={items}
            />
          ) : null}

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
                    <th>{t("report.item")}</th>
                    <th>{t("report.qty")}</th>
                    <th>{t("report.lines")}</th>
                    <th>{t("report.share")}</th>
                    <th>{t("report.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byItem.length ? (
                    data.byItem
                      .slice(itemPaging.offset, itemPaging.offset + itemPaging.limit)
                      .map((x, i) => (
                      <tr key={x.itemCode}>
                        <td className="row-num" data-label={t("admin.table.rowCol")}>{itemPaging.offset + i + 1}</td>
                        <td data-label={t("report.item")}>
                          <b>{itemName(x.itemCode, x.itemName)}</b>
                        </td>
                        <td className="gval" data-label={t("report.qty")}>{fmt(x.qty)}</td>
                        <td data-label={t("report.lines")}>{x.count}</td>
                        <td data-label={t("report.share")}>{x.sharePct.toFixed(1)}%</td>
                        <td className="gval" data-label={t("report.value")}>₩{fmt(x.totalPrice)}</td>
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
                    <th>{t("intake.date")}</th>
                    <th>{t("report.shop")}</th>
                    <th>{t("report.item")}</th>
                    <th>{t("report.qty")}</th>
                    <th>{t("report.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length ? (
                    data.rows
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
