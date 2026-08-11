"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { useLocale } from "@/context/LocaleContext";
import { apiGet } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { AppDateField } from "@/components/ui/AppDateField";
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

type DetailRow = {
  date: string;
  itemCode: string;
  itemNameTH: string;
  totalPrice: number;
};

export function ReportItemPriceView() {
  const { suppliers, items } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();

  const [rFrom, setRFrom] = useState(() => histDatePresetRange("thisMonth").from);
  const [rTo, setRTo] = useState(() => histDatePresetRange("thisMonth").to);
  const [rSupp, setRSupp] = useState("");
  const [datePreset, setDatePreset] = useState("thisMonth");
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);

  function applyPreset(id: string) {
    const { from, to } = histDatePresetRange(id);
    setDatePreset(id);
    setRFrom(from);
    setRTo(to);
  }

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (rFrom) params.set("dateFrom", rFrom);
      if (rTo) params.set("dateTo", rTo);
      if (rSupp) params.set("suppCode", rSupp);
      params.set("page", "1");
      params.set("pageSize", "100000");

      const d = await apiGet<{ success: boolean; rows: DetailRow[] }>(`/api/reports?${params}`);
      if (!d.success) {
        toast(t("report.loadError"));
        return;
      }
      setRows(d.rows);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("report.loadError"));
    } finally {
      setLoading(false);
    }
  }, [rFrom, rTo, rSupp, t, toast]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

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
              <div className="filter-group">
                <label className="lbl" htmlFor="item-price-supp">
                  {t("report.shop")}
                </label>
                <select
                  id="item-price-supp"
                  value={rSupp}
                  onChange={(e) => setRSupp(e.target.value)}
                >
                  <option value="">{t("report.all")}</option>
                  {suppliers.map((s) => (
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
        suppCode={rSupp}
        rows={rows}
        suppliers={suppliers}
        items={items}
      />
    </div>
  );
}
