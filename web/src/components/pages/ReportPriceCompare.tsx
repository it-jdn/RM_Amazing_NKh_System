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
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { IconX } from "@/components/icons/AppIcons";
import { itemDisplayName, itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { fmt, formatAppDate } from "@/lib/utils/format";
import type { Item, Supplier } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface PriceHistRow {
  id: number;
  suppCode: string;
  itemCode: string;
  unitPrice: number;
  priceKind: string;
  source: string;
  recordedAt: string;
}

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
  standardPriceAtSave: number | null;
  totalPrice: number;
}

const QTY_GROUP_COLORS = [
  "rgba(26,107,181,.95)",
  "rgba(232,66,26,.95)",
  "rgba(76,140,74,.95)",
  "rgba(200,150,50,.95)",
  "rgba(140,120,90,.95)",
  "rgba(220,100,140,.95)",
  "rgba(60,160,160,.95)",
];

/** Cluster intake points into groups of similar order quantity so the price trend within each group is comparable. */
function groupPointsByQty(points: IntakePoint[]): { label: string; points: IntakePoint[] }[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.qty - b.qty);
  const groups: IntakePoint[][] = [];
  let current: IntakePoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prevQty = sorted[i - 1].qty;
    const curQty = sorted[i].qty;
    const ratio = prevQty > 0 ? curQty / prevQty : Infinity;
    const startsNewGroup = ratio > 1.4 && curQty - prevQty > Math.max(prevQty * 0.4, 0.5);
    if (startsNewGroup) {
      groups.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  groups.push(current);

  return groups.map((g) => {
    const qtys = g.map((p) => p.qty);
    const min = Math.min(...qtys);
    const max = Math.max(...qtys);
    const unit = g[0]?.mainUnit || "";
    const label = min === max ? `${fmt(min)} ${unit}` : `${fmt(min)}–${fmt(max)} ${unit}`;
    return { label, points: [...g].sort((a, b) => a.date.localeCompare(b.date)) };
  });
}

type DetailRow = {
  date: string;
  itemCode: string;
  itemNameTH: string;
  totalPrice: number;
};

type ItemWithTotal = { item: Item; total: number };

function buildItemsWithTotals(rows: DetailRow[], items: Item[]): ItemWithTotal[] {
  const totals = new Map<string, number>();
  const itemByCode = new Map(items.map((i) => [i.code, i]));
  for (const r of rows) {
    if (!itemByCode.has(r.itemCode)) continue;
    totals.set(r.itemCode, (totals.get(r.itemCode) ?? 0) + r.totalPrice);
  }
  const list: ItemWithTotal[] = [];
  for (const [code, total] of totals) {
    const item = itemByCode.get(code);
    if (item) list.push({ item, total });
  }
  list.sort((a, b) => b.total - a.total || a.item.code.localeCompare(b.item.code));
  return list;
}

export function ReportPriceCompare(props: {
  dateFrom: string;
  dateTo: string;
  suppCode: string;
  rows: DetailRow[];
  suppliers: Supplier[];
  items: Item[];
}) {
  const { locale, t } = useLocale();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedItem, setSelectedItem] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [priceHistory, setPriceHistory] = useState<PriceHistRow[]>([]);
  const [intakePoints, setIntakePoints] = useState<IntakePoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSelectedItem("");
    setSearch("");
    setOpen(false);
  }, [props.dateFrom, props.dateTo]);

  const itemsInPeriod = useMemo(
    () => buildItemsWithTotals(props.rows, props.items),
    [props.rows, props.items]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return itemsInPeriod;
    return itemsInPeriod.filter(({ item }) => {
      const label = itemDisplayName(item, locale).toLowerCase();
      return label.includes(q) || item.code.toLowerCase().includes(q);
    });
  }, [itemsInPeriod, search, locale]);

  useEffect(() => {
    if (!selectedItem) {
      setPriceHistory([]);
      setIntakePoints([]);
      return;
    }
    setLoaded(false);
    const params = new URLSearchParams();
    if (props.dateFrom) params.set("dateFrom", props.dateFrom);
    if (props.dateTo) params.set("dateTo", props.dateTo);
    if (props.suppCode) params.set("suppCode", props.suppCode);
    params.set("itemCode", selectedItem);

    apiGet<{
      success: boolean;
      priceHistory: PriceHistRow[];
      intakePoints: IntakePoint[];
    }>(`/api/reports/price-history?${params}`)
      .then((d) => {
        if (d.success) {
          setPriceHistory(d.priceHistory);
          setIntakePoints(d.intakePoints);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [selectedItem, props.dateFrom, props.dateTo, props.suppCode]);

  const qtyGroups = useMemo(() => groupPointsByQty(intakePoints), [intakePoints]);

  const priceChart = useMemo(() => {
    if (!intakePoints.length) return null;
    const allDates = Array.from(new Set(intakePoints.map((p) => p.date))).sort();
    const labels = allDates.map((d) => formatAppDate(d, locale));

    const groupDatasets = qtyGroups.map((g, i) => {
      const byDate = new Map(g.points.map((p) => [p.date, p.unitPrice]));
      return {
        label: `${t("report.intake")} (${g.label})`,
        data: allDates.map((d) => byDate.get(d) ?? null),
        borderColor: QTY_GROUP_COLORS[i % QTY_GROUP_COLORS.length],
        backgroundColor: "transparent",
        pointRadius: 4,
        tension: 0.2,
        spanGaps: true,
      };
    });

    return {
      labels,
      datasets: groupDatasets,
    };
  }, [intakePoints, qtyGroups, locale, t]);

  function shopLabel(code: string) {
    const s = props.suppliers.find((x) => x.code === code);
    return s ? supplierDisplayName(s, locale) : code;
  }

  function itemLabel(code: string, snapshot?: string) {
    return itemDisplayNameByCode(code, props.items, locale, snapshot);
  }

  function selectItem(code: string) {
    setSelectedItem(code);
    setSearch("");
    setOpen(false);
  }

  function clearSelection() {
    setSelectedItem("");
    setSearch("");
  }

  const atSelected = !!selectedItem;
  const showList = open && filteredItems.length > 0;
  // ซ่อนไว้ก่อน: ตารางประวัติราคามาตรฐาน / รับล่าสุด
  const showPriceHistoryTable: boolean = false;

  return (
    <div className="card report-price-compare">
      <div className="card-title">
        <span className="dot dot-orange" />
        <span>{t("report.priceCompare")}</span>
      </div>
      <p className="admin-hint report-item-cumulative__hint">{t("report.priceTrendHint")}</p>

      {itemsInPeriod.length ? (
        <div className="report-item-cumulative__toolbar">
          <div className="filter-group filter-group--grow report-item-cumulative__field">
            <label className="lbl" htmlFor="report-price-trend-search">
              {t("report.priceTrendPicker")}
            </label>
            <div
              className={`report-item-cumulative__picker${open ? " report-item-cumulative__picker--open" : ""}`}
            >
              {selectedItem ? (
                <div className="report-item-cumulative__selected">
                  {(() => {
                    const row = itemsInPeriod.find((x) => x.item.code === selectedItem);
                    if (!row) return null;
                    return (
                      <span className="report-item-cumulative__pill">
                        <span className="report-item-cumulative__pill-text">
                          {itemDisplayName(row.item, locale)}
                        </span>
                        <button
                          type="button"
                          className="report-item-cumulative__pill-remove"
                          onClick={clearSelection}
                          aria-label={t("report.priceTrendClear")}
                        >
                          <IconX size={14} aria-hidden />
                        </button>
                      </span>
                    );
                  })()}
                </div>
              ) : null}

              <input
                ref={inputRef}
                id="report-price-trend-search"
                type="text"
                className="report-item-cumulative__search-input"
                value={search}
                role="combobox"
                aria-expanded={showList}
                aria-controls={showList ? listId : undefined}
                aria-autocomplete="list"
                placeholder={t("report.priceTrendSearchOpen")}
                autoComplete="off"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setSearch("");
                  }
                }}
              />

              {showList ? (
                <ul id={listId} className="report-item-cumulative__list" role="listbox">
                  {filteredItems.map(({ item, total }) => {
                    const checked = item.code === selectedItem;
                    return (
                      <li key={item.code} role="option" aria-selected={checked}>
                        <button
                          type="button"
                          className={`report-item-cumulative__option${checked ? " report-item-cumulative__option--on" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectItem(item.code)}
                        >
                          <span className="report-item-cumulative__option-label">
                            {itemDisplayName(item, locale)}
                          </span>
                          <span className="report-item-cumulative__option-value">₩{fmt(total)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : open && search.trim() ? (
                <p className="report-item-cumulative__list-empty">{t("report.priceTrendNoMatch")}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="empty">{t("report.noData")}</p>
      )}

      {!atSelected && itemsInPeriod.length > 0 ? (
        <p className="empty report-item-cumulative__empty">{t("report.priceTrendSelect")}</p>
      ) : null}

      {atSelected && loaded && priceChart && (
        <>
          <p className="lbl" style={{ marginBottom: 8, marginTop: 16 }}>
            {t("report.priceTrend")}
          </p>
          <Line
            data={priceChart}
            options={{
              responsive: true,
              plugins: { legend: { position: "top" } },
              scales: {
                y: {
                  ticks: { callback: (v) => "₩" + fmt(Number(v)) },
                },
              },
            }}
          />
        </>
      )}

      {showPriceHistoryTable && atSelected && loaded && priceHistory.length > 0 && (
        <>
          <p className="lbl" style={{ margin: "16px 0 8px" }}>
            {t("report.priceHistory")}
          </p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>{t("report.dateFrom")}</th>
                  <th>{t("report.shop")}</th>
                  <th>{t("report.item")}</th>
                  <th>ประเภท</th>
                  <th>แหล่ง</th>
                  <th>ราคา/หน่วย (₩)</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((r) => (
                  <tr key={r.id}>
                    <td>{r.recordedAt.slice(0, 10)}</td>
                    <td>{shopLabel(r.suppCode)}</td>
                    <td>{r.itemCode}</td>
                    <td>
                      {r.priceKind === "standard"
                        ? t("report.standard")
                        : t("report.lastPurchase")}
                    </td>
                    <td>
                      {r.source === "manual" ? t("report.manual") : t("report.intake")}
                    </td>
                    <td className="gval">₩{fmt(r.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {atSelected && loaded && intakePoints.length > 0 && (
        <>
          <p className="lbl" style={{ margin: "16px 0 8px" }}>
            {t("report.intakePrices")}
          </p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>{t("report.dateFrom")}</th>
                  <th>{t("report.item")}</th>
                  <th>หน่วย</th>
                  <th>{t("report.standard")}</th>
                  <th>{t("report.intake")}</th>
                  <th>{t("report.value")}</th>
                </tr>
              </thead>
              <tbody>
                {intakePoints.slice(-100).map((p, i) => (
                  <tr key={`${p.date}-${p.itemCode}-${i}`}>
                    <td>{formatAppDate(p.date, locale)}</td>
                    <td>
                      <b>{itemLabel(p.itemCode, p.itemNameTH)}</b>
                    </td>
                    <td>
                      {p.mainUnit} / {p.subUnit}
                    </td>
                    <td>
                      {p.standardPriceAtSave != null ? `₩${fmt(p.standardPriceAtSave)}` : "—"}
                    </td>
                    <td className="gval">₩{fmt(p.unitPrice)}</td>
                    <td className="gval">₩{fmt(p.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {atSelected && loaded && !priceHistory.length && !intakePoints.length && (
        <p className="empty">{t("report.noData")}</p>
      )}
    </div>
  );
}
