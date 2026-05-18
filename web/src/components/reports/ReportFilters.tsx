"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { AppDateField } from "@/components/ui/AppDateField";
import { formatAppDate, histDatePresetRange } from "@/lib/utils/format";
import type { Item, ItemCategory, Supplier } from "@/lib/types";

const REPORT_PRESETS = [
  { id: "all", key: "hist.preset.all" },
  { id: "last7", key: "report.preset7" },
  { id: "last30", key: "report.preset30" },
  { id: "thisMonth", key: "report.presetMonth" },
  { id: "lastMonth", key: "report.presetLastMonth" },
] as const;

type Props = {
  dateFrom: string;
  dateTo: string;
  suppCode: string;
  categoryCode: string;
  itemCode: string;
  datePreset: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onSuppCode: (v: string) => void;
  onCategoryCode: (v: string) => void;
  onItemCode: (v: string) => void;
  onDatePreset: (v: string) => void;
  suppliers: Supplier[];
  items: Item[];
  itemCategories: ItemCategory[];
  loading: boolean;
  hasData: boolean;
  dataDateRange?: { dateFrom: string; dateTo: string } | null;
  onPrint: () => void;
};

export function ReportFilters({
  dateFrom,
  dateTo,
  suppCode,
  categoryCode,
  itemCode,
  datePreset,
  onDateFrom,
  onDateTo,
  onSuppCode,
  onCategoryCode,
  onItemCode,
  onDatePreset,
  suppliers,
  items,
  itemCategories,
  loading,
  hasData,
  dataDateRange,
  onPrint,
}: Props) {
  const { locale, t } = useLocale();
  const categories = itemCategories.length ? itemCategories : FALLBACK_ITEM_CATEGORIES;
  const datesDisabled = datePreset === "all";
  const displayFrom =
    datesDisabled && dataDateRange?.dateFrom ? dataDateRange.dateFrom : dateFrom;
  const displayTo = datesDisabled && dataDateRange?.dateTo ? dataDateRange.dateTo : dateTo;

  const itemOptions = useMemo(() => {
    if (!categoryCode) return items;
    return items.filter((i) => i.categoryCode === categoryCode);
  }, [items, categoryCode]);

  function applyPreset(id: string) {
    const { from, to } = histDatePresetRange(id);
    onDatePreset(id);
    onDateFrom(from);
    onDateTo(to);
  }

  function onManualDate(which: "from" | "to", value: string) {
    if (which === "from") onDateFrom(value);
    else onDateTo(value);
    onDatePreset("custom");
  }

  function onCategoryChange(next: string) {
    onCategoryCode(next);
    if (next && itemCode) {
      const item = items.find((i) => i.code === itemCode);
      if (item && item.categoryCode !== next) onItemCode("");
    }
  }

  return (
    <div className="report-filters no-print">
      <div className="report-filters__top">
        <h1 className="report-filters__title">{t("report.title")}</h1>
        <div className="report-filters__actions">
          {loading ? (
            <span className="report-filters__loading" aria-live="polite">
              {t("report.loading")}
            </span>
          ) : null}
          {hasData ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onPrint}>
              {t("report.print")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="hist-presets report-filters__presets">
        <span className="hist-presets__label">{t("hist.period")}</span>
        <div className="hist-presets__chips">
          {REPORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`sort-toggle hist-preset-btn ${datePreset === p.id ? "active" : ""}`}
              onClick={() => applyPreset(p.id)}
            >
              {t(p.key)}
            </button>
          ))}
        </div>
      </div>

      {datePreset === "all" && !loading && hasData ? (
        <p className="report-filters__data-range" role="status">
          {dataDateRange
            ? t("report.dataRange", {
                from: formatAppDate(dataDateRange.dateFrom, locale),
                to: formatAppDate(dataDateRange.dateTo, locale),
              })
            : t("report.dataRangeEmpty")}
        </p>
      ) : null}

      <div className="report-filters__fields">
        <div className="filter-group filter-group--date">
          <label className="lbl" htmlFor="report-from">
            {t("report.dateFrom")}
          </label>
          <AppDateField
            id="report-from"
            value={displayFrom}
            onChange={(v) => onManualDate("from", v)}
            placeholder={t("report.dateFrom")}
            aria-label={t("report.dateFrom")}
            disabled={datesDisabled}
          />
        </div>
        <div className="filter-group filter-group--date">
          <label className="lbl" htmlFor="report-to">
            {t("report.dateTo")}
          </label>
          <AppDateField
            id="report-to"
            value={displayTo}
            onChange={(v) => onManualDate("to", v)}
            placeholder={t("report.dateTo")}
            aria-label={t("report.dateTo")}
            disabled={datesDisabled}
          />
        </div>
        <div className="filter-group">
          <label className="lbl" htmlFor="report-supp">
            {t("report.shop")}
          </label>
          <select
            id="report-supp"
            value={suppCode}
            onChange={(e) => onSuppCode(e.target.value)}
          >
            <option value="">{t("report.all")}</option>
            {suppliers.map((s) => (
              <option key={s.code} value={s.code}>
                {supplierDisplayName(s, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="lbl" htmlFor="report-cat">
            {t("report.category")}
          </label>
          <select
            id="report-cat"
            value={categoryCode}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">{t("report.categoryAll")}</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {itemCategoryDisplayName(c, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group filter-group--grow">
          <label className="lbl" htmlFor="report-item">
            {t("report.item")}
          </label>
          <select
            id="report-item"
            value={itemCode}
            onChange={(e) => onItemCode(e.target.value)}
          >
            <option value="">{t("report.all")}</option>
            {itemOptions.map((i) => (
              <option key={i.code} value={i.code}>
                {i.nameTH}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
