"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { itemDisplayName, sortItemsByDisplayName } from "@/lib/i18n/item-name";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { MessageKey } from "@/lib/i18n/messages";
import { AppDateField } from "@/components/ui/AppDateField";
import { IconChevronDown, IconPrint } from "@/components/icons/AppIcons";
import { formatAppDate, histDatePresetRange } from "@/lib/utils/format";
import type { Item, ItemCategory, Supplier } from "@/lib/types";

const REPORT_PRESETS = [
  { id: "all", key: "hist.preset.all" },
  { id: "today", key: "report.presetToday" },
  { id: "last7", key: "report.preset7" },
  { id: "last30", key: "report.preset30" },
  { id: "thisMonth", key: "report.presetMonth" },
  { id: "lastMonth", key: "report.presetLastMonth" },
] as const;

const PRESET_LABEL: Record<string, MessageKey> = {
  all: "hist.preset.all",
  today: "report.presetToday",
  last7: "report.preset7",
  last30: "report.preset30",
  thisMonth: "report.presetMonth",
  lastMonth: "report.presetLastMonth",
};

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
  const [filtersOpen, setFiltersOpen] = useState(true);
  const categories = itemCategories.length ? itemCategories : FALLBACK_ITEM_CATEGORIES;
  const datesDisabled = datePreset === "all";
  const displayFrom =
    datesDisabled && dataDateRange?.dateFrom ? dataDateRange.dateFrom : dateFrom;
  const displayTo = datesDisabled && dataDateRange?.dateTo ? dataDateRange.dateTo : dateTo;

  const itemOptions = useMemo(() => {
    const list = categoryCode
      ? items.filter((i) => i.categoryCode === categoryCode)
      : items;
    return sortItemsByDisplayName(list, locale);
  }, [items, categoryCode, locale]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];

    if (datePreset === "all") {
      if (dataDateRange) {
        parts.push(
          `${formatAppDate(dataDateRange.dateFrom, locale)} – ${formatAppDate(dataDateRange.dateTo, locale)}`
        );
      } else {
        parts.push(t("hist.preset.all"));
      }
    } else if (datePreset !== "custom" && PRESET_LABEL[datePreset]) {
      parts.push(t(PRESET_LABEL[datePreset]));
    } else if (displayFrom || displayTo) {
      const from = displayFrom ? formatAppDate(displayFrom, locale) : "…";
      const to = displayTo ? formatAppDate(displayTo, locale) : "…";
      parts.push(`${from} – ${to}`);
    }

    if (suppCode) {
      const shop = suppliers.find((s) => s.code === suppCode);
      parts.push(shop ? supplierDisplayName(shop, locale) : suppCode);
    }
    if (categoryCode) {
      const cat = categories.find((c) => c.code === categoryCode);
      parts.push(cat ? itemCategoryDisplayName(cat, locale) : categoryCode);
    }
    if (itemCode) {
      const item = items.find((i) => i.code === itemCode);
      parts.push(item?.nameTH || itemCode);
    }

    return parts.join(" · ");
  }, [
    categories,
    categoryCode,
    dataDateRange,
    datePreset,
    displayFrom,
    displayTo,
    itemCode,
    items,
    locale,
    suppCode,
    suppliers,
    t,
  ]);

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

  function renderPrintBtn(key: string) {
    if (!hasData) return null;
    return (
      <button
        key={key}
        type="button"
        className="report-filters__icon-btn report-filters__print-btn"
        onClick={onPrint}
        aria-label={t("report.print")}
        title={t("report.print")}
      >
        <IconPrint size={18} aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={`report-filters no-print${filtersOpen ? "" : " report-filters--collapsed"}`}
    >
      <div className="report-filters__top">
        <button
          type="button"
          className="report-filters__toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="report-filters-panel"
          aria-label={filtersOpen ? t("report.filtersCollapse") : t("report.filtersExpand")}
        >
          <IconChevronDown
            size={18}
            className={`report-filters__chev${filtersOpen ? " report-filters__chev--open" : ""}`}
            aria-hidden
          />
        </button>
        <select
          className="hist-preset-select hist-preset-select--mobile report-filters__preset-select"
          value={REPORT_PRESETS.some((p) => p.id === datePreset) ? datePreset : "custom"}
          onChange={(e) => {
            if (e.target.value !== "custom") applyPreset(e.target.value);
          }}
          aria-label={t("hist.period")}
        >
          {REPORT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(p.key)}
            </option>
          ))}
        </select>
        <div className="report-filters__title-wrap">
          <h1 className="report-filters__title">{t("report.title")}</h1>
          {!filtersOpen && filterSummary ? (
            <p className="report-filters__summary">{filterSummary}</p>
          ) : null}
        </div>
        <div className="report-filters__actions report-filters__actions--desktop">
          {loading ? (
            <span className="report-filters__loading" aria-live="polite">
              {t("report.loading")}
            </span>
          ) : null}
        </div>
        {loading ? (
          <span className="report-filters__loading report-filters__loading--mobile" aria-live="polite">
            {t("report.loading")}
          </span>
        ) : null}
        {!filtersOpen ? (
          <div className="report-filters__actions report-filters__actions--collapsed-print">
            {renderPrintBtn("print-collapsed")}
          </div>
        ) : (
          <div className="report-filters__actions report-filters__actions--open-print">
            {renderPrintBtn("print-open")}
          </div>
        )}
      </div>

      <div
        id="report-filters-panel"
        className={`report-filters__body${filtersOpen ? "" : " report-filters__body--collapsed"}`}
        aria-hidden={!filtersOpen}
      >
        <div className="report-filters__body-inner">
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
                    {itemDisplayName(i, locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
