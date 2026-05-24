"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { supplierDisplayName, supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import type { Supplier } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { useToast } from "@/components/Toast";
import { AppDateField } from "@/components/ui/AppDateField";
import { IconChevronDown, IconRefresh } from "@/components/icons/AppIcons";
import { PageBackLink } from "@/components/ui/PageBackLink";
import {
  fmt,
  formatAppMonthYear,
  getAppDayOfWeekLabel,
  HIST_DATE_PRESETS,
  histDatePresetRange,
} from "@/lib/utils/format";
import { HistorySlipDetail } from "@/components/history/HistorySlipDetail";
import type { Locale } from "@/lib/i18n/types";
import type { TransactionRow } from "@/lib/types";

const HIST_PRESET_KEYS: Record<string, MessageKey> = {
  today: "hist.preset.today",
  yesterday: "hist.preset.yesterday",
  last7: "hist.preset.last7",
  last30: "hist.preset.last30",
  thisMonth: "hist.preset.thisMonth",
  lastMonth: "hist.preset.lastMonth",
  all: "hist.preset.all",
};

export function HistoryView() {
  const { suppliers, items, mapping, role } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();
  const [histTxns, setHistTxns] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [histSortAsc, setHistSortAsc] = useState(false);
  const [hFrom, setHFrom] = useState(() => histDatePresetRange("thisMonth").from);
  const [hTo, setHTo] = useState(() => histDatePresetRange("thisMonth").to);
  const [hSupp, setHSupp] = useState("");
  const [datePreset, setDatePreset] = useState("thisMonth");
  const [detail, setDetail] = useState<{ date: string; suppCode: string } | null>(null);

  const loadHist = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ success: boolean; rows: TransactionRow[] }>("/api/transactions");
      if (!d.success) {
        toast(t("hist.loadFail"));
        return;
      }
      setHistTxns(d.rows.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadHist();
  }, [loadHist]);

  if (detail) {
    return (
      <div className="wrap wrap--hist-detail wrap--with-sticky-save">
        <PageBackLink
          label={t("hist.back").replace(/^←\s*/, "")}
          onClick={() => setDetail(null)}
        />
        <HistorySlipDetail
          date={detail.date}
          suppCode={detail.suppCode}
          histTxns={histTxns}
          items={items}
          mapping={mapping}
          role={role}
          onSaved={loadHist}
          onDeleted={async () => {
            await loadHist();
            setDetail(null);
          }}
        />
      </div>
    );
  }

  const filtered = histTxns.filter((t) => {
    if (hFrom && t.date < hFrom) return false;
    if (hTo && t.date > hTo) return false;
    if (hSupp && t.suppCode !== hSupp) return false;
    return true;
  });

  const groups: Record<
    string,
    { date: string; suppCode: string; suppName: string; total: number; count: number }
  > = {};
  filtered.forEach((t) => {
    const key = t.date + "||" + t.suppCode;
    if (!groups[key]) {
      groups[key] = {
        date: t.date,
        suppCode: t.suppCode,
        suppName: t.suppName || t.suppCode,
        total: 0,
        count: 0,
      };
    }
    groups[key].total += parseFloat(String(t.totalPrice)) || 0;
    groups[key].count++;
  });

  const sorted = Object.values(groups).sort((a, b) => {
    const cmp = String(a.date).localeCompare(String(b.date));
    return histSortAsc ? cmp : -cmp;
  });

  let lastMonth = "";

  return (
    <div className="wrap wrap--hist-list">
      <HistFilters
        hFrom={hFrom}
        setHFrom={setHFrom}
        hTo={hTo}
        setHTo={setHTo}
        hSupp={hSupp}
        setHSupp={setHSupp}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        suppliers={suppliers}
        histSortAsc={histSortAsc}
        setHistSortAsc={setHistSortAsc}
        itemCount={sorted.length}
      />
      {sorted.length > 0 && (
        <div className="hist-count-bar hist-count-bar--desktop">
          {t("hist.itemsCount", { n: sorted.length })}
        </div>
      )}
      {loading ? (
        <div className="hist-empty">{t("hist.loading")}</div>
      ) : !sorted.length ? (
        <div className="hist-empty">
          {histTxns.length > 0
            ? t("hist.emptyFiltered")
            : t("hist.empty")}
        </div>
      ) : (
        <div className="hist-list-groups">
          {sorted.map((g) => {
            const mo = String(g.date).substring(0, 7);
            const showMonth = mo !== lastMonth;
            if (showMonth) lastMonth = mo;
            const [y, m] = mo.split("-");
            const dd = new Date(String(g.date).substring(0, 10) + "T00:00:00");
            return (
              <HistGroup
                key={g.date + g.suppCode}
                g={g}
                suppliers={suppliers}
                showMonth={showMonth}
                y={y}
                m={m}
                dd={dd}
                locale={locale}
                onOpen={() => setDetail({ date: g.date, suppCode: g.suppCode })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistFilters(props: {
  hFrom: string;
  setHFrom: (v: string) => void;
  hTo: string;
  setHTo: (v: string) => void;
  hSupp: string;
  setHSupp: (v: string) => void;
  datePreset: string;
  setDatePreset: (v: string) => void;
  suppliers: Supplier[];
  histSortAsc: boolean;
  setHistSortAsc: (v: boolean) => void;
  itemCount: number;
}) {
  const { locale, t } = useLocale();
  const [filtersOpen, setFiltersOpen] = useState(false);

  function applyPreset(id: string) {
    const { from, to } = histDatePresetRange(id);
    props.setDatePreset(id);
    props.setHFrom(from);
    props.setHTo(to);
  }

  function onManualDateChange(which: "from" | "to", value: string) {
    if (which === "from") props.setHFrom(value);
    else props.setHTo(value);
    props.setDatePreset("custom");
  }

  return (
    <div className={`hist-filters hist-filters--stack${filtersOpen ? " hist-filters--open" : ""}`}>
      <div className="hist-filters__mobile-head">
        <button
          type="button"
          className="hist-filters__toggle"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? t("hist.filterCollapse") : t("hist.filterExpand")}
        >
          <IconChevronDown
            size={18}
            className={`hist-filters__toggle-chev${filtersOpen ? " hist-filters__toggle-chev--open" : ""}`}
            aria-hidden
          />
        </button>
        <select
          className="hist-preset-select hist-preset-select--mobile"
          value={
            HIST_DATE_PRESETS.some((p) => p.id === props.datePreset) ? props.datePreset : "custom"
          }
          onChange={(e) => {
            if (e.target.value !== "custom") applyPreset(e.target.value);
          }}
          aria-label={t("hist.period")}
        >
          {HIST_DATE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(HIST_PRESET_KEYS[p.id] ?? "hist.preset.all")}
            </option>
          ))}
          <option value="custom">{t("hist.preset.custom")}</option>
        </select>
        {!filtersOpen && props.itemCount > 0 ? (
          <span className="hist-filters__count">{t("hist.itemsCount", { n: props.itemCount })}</span>
        ) : null}
      </div>
      <div className="hist-filters__period hist-filters__period--desktop">
        <select
          className="hist-preset-select hist-preset-select--mobile"
          value={
            HIST_DATE_PRESETS.some((p) => p.id === props.datePreset) ? props.datePreset : "custom"
          }
          onChange={(e) => {
            if (e.target.value !== "custom") applyPreset(e.target.value);
          }}
          aria-label={t("hist.period")}
        >
          {HIST_DATE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(HIST_PRESET_KEYS[p.id] ?? "hist.preset.all")}
            </option>
          ))}
          <option value="custom">{t("hist.preset.custom")}</option>
        </select>
        <div className="hist-presets hist-presets--desktop">
          <span className="hist-presets__label">{t("hist.period")}</span>
          <div className="hist-presets__chips">
            {HIST_DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sort-toggle hist-preset-btn ${props.datePreset === p.id ? "active" : ""}`}
                onClick={() => applyPreset(p.id)}
              >
                {t(HIST_PRESET_KEYS[p.id] ?? "hist.preset.all")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="hist-filters__collapsible">
      <div className="hist-filters__dates">
        <div className="filter-group">
          <label className="lbl">{t("hist.dateFrom")}</label>
          <AppDateField
            id="hist-date-from"
            value={props.hFrom}
            onChange={(v) => onManualDateChange("from", v)}
            placeholder={t("hist.dateFromShort")}
            aria-label={t("hist.dateFrom")}
          />
        </div>
        <div className="filter-group">
          <label className="lbl">{t("hist.dateTo")}</label>
          <AppDateField
            id="hist-date-to"
            value={props.hTo}
            onChange={(v) => onManualDateChange("to", v)}
            placeholder={t("hist.dateToShort")}
            aria-label={t("hist.dateTo")}
          />
        </div>
      </div>
      <div className="hist-filters__bottom">
        <div className="filter-group grow hist-filters__shop">
          <label className="lbl">{t("hist.supplier")}</label>
          <select value={props.hSupp} onChange={(e) => props.setHSupp(e.target.value)}>
            <option value="">{t("hist.allSuppliers")}</option>
            {props.suppliers.map((s) => (
              <option key={s.code} value={s.code}>
                {supplierDisplayName(s, locale)}
              </option>
            ))}
          </select>
        </div>
        {filtersOpen && props.itemCount > 0 ? (
          <span className="hist-filters__count">{t("hist.itemsCount", { n: props.itemCount })}</span>
        ) : null}
        <div className="hist-filters__tools">
          <button
            type="button"
            className={`sort-toggle hist-filters__tool ${!props.histSortAsc ? "active" : ""}`}
            onClick={() => props.setHistSortAsc(!props.histSortAsc)}
            aria-label={props.histSortAsc ? t("hist.sortOldest") : t("hist.sortNewest")}
            title={props.histSortAsc ? t("hist.sortOldest") : t("hist.sortNewest")}
          >
            <span className="hist-filters__tool-text">
              {props.histSortAsc ? t("hist.sortOldest") : t("hist.sortNewest")}
            </span>
            <span className="hist-filters__tool-icon" aria-hidden>
              {props.histSortAsc ? "↑" : "↓"}
            </span>
          </button>
          <button
            type="button"
            className="filter-clear hist-filters__tool hist-filters__tool--icon"
            onClick={() => {
              applyPreset("today");
              props.setHSupp("");
            }}
            aria-label={t("hist.reset")}
            title={t("hist.reset")}
          >
            <span className="hist-filters__tool-text">{t("hist.reset")}</span>
            <IconRefresh size={16} className="hist-filters__tool-icon-svg" aria-hidden />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function HistGroup({
  g,
  suppliers,
  showMonth,
  y,
  m,
  dd,
  locale,
  onOpen,
}: {
  g: { date: string; suppCode: string; suppName: string; count: number; total: number };
  suppliers: Supplier[];
  showMonth: boolean;
  y: string;
  m: string;
  dd: Date;
  locale: Locale;
  onOpen: () => void;
}) {
  const { t } = useLocale();
  const displayName = supplierDisplayNameByCode(g.suppCode, suppliers, locale, g.suppName);
  const shopLabel =
    displayName.length > 48 ? `${displayName.substring(0, 48)}…` : displayName;

  return (
    <div className="hist-list-group">
      {showMonth ? (
        <div className="hist-month-sep">{formatAppMonthYear(y, m, locale)}</div>
      ) : null}
      <div
        className="hist-day-card hist-day-card--tap"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
      >
        <div className="hist-day-card__inner">
          <div className="hist-day-card__date" aria-hidden>
            <span className="hist-day-card__date-num">{dd.getDate()}</span>
            <span className="hist-day-card__date-dow">
              {getAppDayOfWeekLabel(dd.getDay(), locale)}
            </span>
          </div>
          <div className="hist-day-card__content">
            <div className="hist-day-card__shop">{shopLabel}</div>
            <div className="hist-day-card__summary">
              <span className="hist-day-card__summary-lines">
                {t("hist.summaryLines", { n: g.count })}
              </span>
              <span className="hist-day-card__summary-total">
                <span className="hist-day-card__summary-total-label">{t("hist.summaryTotal")}</span>
                <span className="hist-day-card__summary-total-value">₩{fmt(g.total)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

