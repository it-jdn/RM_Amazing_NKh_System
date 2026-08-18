"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { useLocale } from "@/context/LocaleContext";
import { AppDateField } from "@/components/ui/AppDateField";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { histDatePresetRange } from "@/lib/utils/format";
import { ReportPriceCompare } from "@/components/pages/ReportPriceCompare";

const PRESETS = [
  { id: "all", key: "hist.preset.all" },
  { id: "today", key: "report.presetToday" },
  { id: "thisWeek", key: "report.presetWeek" },
  { id: "last30", key: "report.preset30" },
  { id: "thisMonth", key: "report.presetMonth" },
  { id: "lastMonth", key: "report.presetLastMonth" },
  { id: "last2Months", key: "report.preset2Months" },
  { id: "last3Months", key: "report.preset3Months" },
] as const;

export function ReportItemPriceView() {
  const { suppliers, items, mapping, itemCategories } = useAppData();
  const { locale, t } = useLocale();
  const categories = itemCategories.length ? itemCategories : FALLBACK_ITEM_CATEGORIES;

  const [rFrom, setRFrom] = useState(() => histDatePresetRange("thisMonth").from);
  const [rTo, setRTo] = useState(() => histDatePresetRange("thisMonth").to);
  const [rCategory, setRCategory] = useState("");
  const [rSupp, setRSupp] = useState("");
  const [datePreset, setDatePreset] = useState("thisMonth");

  const visibleSuppliers = useMemo(() => {
    if (!rCategory) return suppliers;
    const allowedCodes = new Set(items.filter((item) => item.categoryCode === rCategory).map((item) => item.code));
    const allowedShops = new Set(mapping.filter((row) => allowedCodes.has(row.itemCode)).map((row) => row.suppCode));
    return suppliers.filter((supplier) => allowedShops.has(supplier.code));
  }, [items, mapping, rCategory, suppliers]);

  function applyPreset(id: string) {
    const { from, to } = histDatePresetRange(id);
    setDatePreset(id);
    setRFrom(from);
    setRTo(to);
  }

  return (
    <div className="wrap report-page">
      <div className="report-filters no-print">
        <div className="report-filters__top">
          <div className="report-filters__title-wrap">
            <h1 className="report-filters__title">{t("nav.report.itemPrice")}</h1>
          </div>
        </div>
        <div className="report-filters__body">
          <div className="report-filters__body-inner">
            <div className="hist-presets report-filters__presets">
              <span className="hist-presets__label">{t("hist.period")}</span>
              <div className="hist-presets__chips">
                {PRESETS.map((p) => (
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

            <div className="report-filters__fields">
              <div className="filter-group filter-group--date">
                <label className="lbl" htmlFor="item-price-from">
                  {t("report.dateFrom")}
                </label>
                <AppDateField
                  id="item-price-from"
                  value={rFrom}
                  onChange={(v) => {
                    setRFrom(v);
                    setDatePreset("custom");
                  }}
                  placeholder={t("report.dateFrom")}
                  aria-label={t("report.dateFrom")}
                />
              </div>
              <div className="filter-group filter-group--date">
                <label className="lbl" htmlFor="item-price-to">
                  {t("report.dateTo")}
                </label>
                <AppDateField
                  id="item-price-to"
                  value={rTo}
                  onChange={(v) => {
                    setRTo(v);
                    setDatePreset("custom");
                  }}
                  placeholder={t("report.dateTo")}
                  aria-label={t("report.dateTo")}
                />
              </div>
              <div className="filter-group report-filters__field-wide">
                <label className="lbl" htmlFor="item-price-category">
                  {t("report.category")}
                </label>
                <select
                  id="item-price-category"
                  value={rCategory}
                  onChange={(e) => setRCategory(e.target.value)}
                >
                  <option value="">{t("report.categoryAll")}</option>
                  {categories.map((category) => (
                    <option key={category.code} value={category.code}>
                      {itemCategoryDisplayName(category, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group report-filters__field-wide">
                <label className="lbl" htmlFor="item-price-supp">
                  {t("report.shop")}
                </label>
                <select
                  id="item-price-supp"
                  value={rSupp}
                  onChange={(e) => setRSupp(e.target.value)}
                >
                  <option value="">{t("report.all")}</option>
                  {visibleSuppliers.map((s) => (
                    <option key={s.code} value={s.code}>
                      {supplierDisplayName(s, locale)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ReportPriceCompare
        dateFrom={rFrom}
        dateTo={rTo}
        categoryCode={rCategory}
        suppCode={rSupp}
        suppliers={suppliers}
        items={items}
      />
    </div>
  );
}
