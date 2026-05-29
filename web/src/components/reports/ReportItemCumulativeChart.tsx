"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { useLocale } from "@/context/LocaleContext";
import { IconX } from "@/components/icons/AppIcons";
import { itemDisplayName, itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { buildItemCumulativeChart } from "@/lib/reports/item-cumulative-chart";
import { fmt, formatAppDate } from "@/lib/utils/format";
import type { Item } from "@/lib/types";

const CHART_LINE_COLORS = [
  "rgba(26,107,181,.95)",
  "rgba(232,66,26,.95)",
  "rgba(76,140,74,.95)",
  "rgba(120,90,180,.95)",
  "rgba(200,150,50,.95)",
  "rgba(220,100,140,.95)",
  "rgba(60,160,160,.95)",
  "rgba(140,120,90,.95)",
];
const CHART_FILL_COLORS = [
  "rgba(26,107,181,.12)",
  "rgba(232,66,26,.12)",
  "rgba(76,140,74,.12)",
  "rgba(120,90,180,.12)",
  "rgba(200,150,50,.12)",
  "rgba(220,100,140,.12)",
  "rgba(60,160,160,.12)",
  "rgba(140,120,90,.12)",
];

const MAX_COMPARE = 8;

type DetailRow = {
  date: string;
  itemCode: string;
  itemNameTH: string;
  totalPrice: number;
};

type ItemWithTotal = {
  item: Item;
  total: number;
};

type Props = {
  rows: DetailRow[];
  items: Item[];
  categoryCode: string;
  dateFrom: string;
  dateTo: string;
  datePreset: string;
};

function buildItemsWithTotals(
  rows: DetailRow[],
  items: Item[],
  categoryCode: string
): ItemWithTotal[] {
  const totals = new Map<string, number>();
  const itemByCode = new Map(items.map((i) => [i.code, i]));

  for (const r of rows) {
    const item = itemByCode.get(r.itemCode);
    if (!item) continue;
    if (categoryCode && item.categoryCode !== categoryCode) continue;
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

export function ReportItemCumulativeChart({
  rows,
  items,
  categoryCode,
  dateFrom,
  dateTo,
  datePreset,
}: Props) {
  const { locale, t } = useLocale();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSelected([]);
    setSearch("");
    setOpen(false);
  }, [dateFrom, dateTo, datePreset]);

  const itemsInPeriod = useMemo(
    () => buildItemsWithTotals(rows, items, categoryCode),
    [rows, items, categoryCode]
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return itemsInPeriod;
    return itemsInPeriod.filter(({ item }) => {
      const label = itemDisplayName(item, locale).toLowerCase();
      return label.includes(q) || item.code.toLowerCase().includes(q);
    });
  }, [itemsInPeriod, search, locale]);

  const { labels, series } = useMemo(
    () =>
      buildItemCumulativeChart(
        rows.map((r) => ({ date: r.date, itemCode: r.itemCode, totalPrice: r.totalPrice })),
        selected
      ),
    [rows, selected]
  );

  const chartData = useMemo(() => {
    if (!labels.length || !series.length) return null;
    return {
      labels: labels.map((d) => formatAppDate(d, locale)),
      datasets: series.map((s, i) => ({
        label: itemDisplayNameByCode(
          s.itemCode,
          items,
          locale,
          rows.find((r) => r.itemCode === s.itemCode)?.itemNameTH
        ),
        data: s.values,
        borderColor: CHART_LINE_COLORS[i % CHART_LINE_COLORS.length],
        backgroundColor: CHART_FILL_COLORS[i % CHART_FILL_COLORS.length],
        fill: false,
        tension: 0.2,
        pointRadius: labels.length > 31 ? 0 : 3,
        pointHoverRadius: 5,
      })),
    };
  }, [labels, series, items, locale, rows]);

  function toggleItem(code: string) {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, code];
    });
  }

  function removeItem(code: string) {
    setSelected((prev) => prev.filter((c) => c !== code));
  }

  function wonTicks(v: string | number) {
    return "₩" + fmt(Number(v));
  }

  const atLimit = selected.length >= MAX_COMPARE;
  const showList = open && filteredItems.length > 0;

  return (
    <div className="card report-item-cumulative">
      <div className="card-title">
        <span className="dot dot-blue" />
        <span>{t("report.itemCumulative")}</span>
      </div>
      <p className="admin-hint report-item-cumulative__hint">{t("report.itemCumulativeHint")}</p>

      {itemsInPeriod.length ? (
        <>
          <div className="report-item-cumulative__toolbar">
            <div className="filter-group filter-group--grow report-item-cumulative__field">
              <label className="lbl" htmlFor="report-item-cumulative-search">
                {t("report.itemCumulativePicker")}
              </label>
              <div
                className={`report-item-cumulative__picker${open ? " report-item-cumulative__picker--open" : ""}`}
              >
                {selected.length > 0 ? (
                  <div className="report-item-cumulative__selected">
                    {selected.map((code) => {
                      const row = itemsInPeriod.find((x) => x.item.code === code);
                      if (!row) return null;
                      return (
                        <span key={code} className="report-item-cumulative__pill">
                          <span className="report-item-cumulative__pill-text">
                            {itemDisplayName(row.item, locale)}
                          </span>
                          <button
                            type="button"
                            className="report-item-cumulative__pill-remove"
                            onClick={() => removeItem(code)}
                            aria-label={t("report.itemCumulativeRemove")}
                          >
                            <IconX size={14} aria-hidden />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                <input
                  ref={inputRef}
                  id="report-item-cumulative-search"
                  type="text"
                  className="report-item-cumulative__search-input"
                  value={search}
                  role="combobox"
                  aria-expanded={showList}
                  aria-controls={showList ? listId : undefined}
                  aria-autocomplete="list"
                  placeholder={t("report.itemCumulativeSearchOpen")}
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
                      const checked = selected.includes(item.code);
                      const disabled = !checked && atLimit;
                      return (
                        <li key={item.code} role="option" aria-selected={checked}>
                          <button
                            type="button"
                            className={`report-item-cumulative__option${checked ? " report-item-cumulative__option--on" : ""}`}
                            disabled={disabled}
                            title={disabled ? t("report.itemCumulativeMax") : undefined}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => toggleItem(item.code)}
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
                  <p className="report-item-cumulative__list-empty">{t("report.itemCumulativeNoMatch")}</p>
                ) : null}
              </div>
            </div>

            <div className="report-item-cumulative__meta">
              <span className="report-item-cumulative__count" role="status">
                {t("report.itemCumulativeSelected", {
                  n: String(selected.length),
                  max: String(MAX_COMPARE),
                })}
              </span>
              {selected.length > 0 ? (
                <button type="button" className="filter-clear" onClick={() => setSelected([])}>
                  {t("report.itemCumulativeClear")}
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="empty">{t("report.noData")}</p>
      )}

      {selected.length > 0 && chartData ? (
        <div className="report-item-cumulative__chart">
          <Line
            data={chartData}
            options={{
              responsive: true,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: { position: "top", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
              },
              scales: {
                y: { ticks: { callback: wonTicks } },
              },
            }}
          />
        </div>
      ) : selected.length === 0 && itemsInPeriod.length > 0 ? (
        <p className="empty report-item-cumulative__empty">{t("report.itemCumulativeSelect")}</p>
      ) : null}
    </div>
  );
}
