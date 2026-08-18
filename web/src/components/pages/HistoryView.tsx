"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { itemDisplayName, sortItemsByDisplayName } from "@/lib/i18n/item-name";
import { supplierDisplayName, supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import type { IntakeSlipSummary, Item, ItemCategory, Supplier } from "@/lib/types";
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
import { HistoryListTable } from "@/components/history/HistoryListTable";
import {
  ReportTablePager,
  useReportTablePaging,
} from "@/components/reports/ReportTablePager";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { filterHistoryTransactions } from "@/lib/domain/history-list-filter";
import { buildHistoryListGroups } from "@/lib/domain/history-list-groups";
import {
  DEFAULT_HISTORY_LIST_SORT,
  sortHistoryListGroups,
  toggleHistoryListSort,
  type HistoryListSortState,
} from "@/lib/domain/history-list-sort";
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
  const { suppliers, items, mapping, role, itemCategories } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();
  const [histTxns, setHistTxns] = useState<TransactionRow[]>([]);
  const [histSlips, setHistSlips] = useState<IntakeSlipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [histSort, setHistSort] = useState<HistoryListSortState>(DEFAULT_HISTORY_LIST_SORT);
  const [hFrom, setHFrom] = useState(() => histDatePresetRange("thisMonth").from);
  const [hTo, setHTo] = useState(() => histDatePresetRange("thisMonth").to);
  const [hSupp, setHSupp] = useState("");
  const [hCategory, setHCategory] = useState("");
  const [hItemSearch, setHItemSearch] = useState("");
  const [hItemCode, setHItemCode] = useState("");
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

  useEffect(() => {
    let cancelled = false;

    async function loadSlips() {
      let slipFrom = hFrom;
      let slipTo = hTo;
      if (!slipFrom || !slipTo) {
        if (histTxns.length === 0) {
          if (!cancelled) setHistSlips([]);
          return;
        }
        slipFrom = histTxns.reduce(
          (min, row) => (row.date < min ? row.date : min),
          histTxns[0]!.date
        );
        slipTo = histTxns.reduce(
          (max, row) => (row.date > max ? row.date : max),
          histTxns[0]!.date
        );
      }

      try {
        const query = new URLSearchParams({ dateFrom: slipFrom, dateTo: slipTo });
        const data = await apiGet<{ success: boolean; slips: IntakeSlipSummary[] }>(
          `/api/transactions/slips?${query}`
        );
        if (!cancelled && data.success) setHistSlips(data.slips);
      } catch {
        if (!cancelled) setHistSlips([]);
      }
    }

    void loadSlips();
    return () => {
      cancelled = true;
    };
  }, [histTxns, hFrom, hTo]);

  const baseGroups = useMemo(() => {
    const filtered = filterHistoryTransactions(
      histTxns.filter((txn) => {
        if (hFrom && txn.date < hFrom) return false;
        if (hTo && txn.date > hTo) return false;
        if (hSupp && txn.suppCode !== hSupp) return false;
        return true;
      }),
      {
        categoryCode: hCategory,
        itemSearch: hItemSearch,
        itemCode: hItemCode,
        items,
        locale,
      }
    );

    return buildHistoryListGroups(filtered, histSlips);
  }, [histTxns, histSlips, hFrom, hTo, hSupp, hCategory, hItemSearch, hItemCode, items, locale]);

  const sorted = useMemo(
    () => sortHistoryListGroups(baseGroups, histSort, suppliers, locale),
    [baseGroups, histSort, suppliers, locale]
  );

  const paging = useReportTablePaging(sorted.length, 50);
  const visibleRows = useMemo(
    () => sorted.slice(paging.offset, paging.offset + paging.limit),
    [sorted, paging.offset, paging.limit]
  );

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
        hCategory={hCategory}
        setHCategory={setHCategory}
        hItemSearch={hItemSearch}
        setHItemSearch={setHItemSearch}
        hItemCode={hItemCode}
        setHItemCode={setHItemCode}
        items={items}
        itemCategories={itemCategories}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        suppliers={suppliers}
        itemCount={sorted.length}
      />
      {sorted.length > 0 && (
        <div className="hist-list-toolbar hist-count-bar--desktop">
          <span className="hist-list-toolbar__count">{t("hist.itemsCount", { n: sorted.length })}</span>
          <ReportTablePager
            alwaysShow
            totalRows={sorted.length}
            pageSize={paging.pageSize}
            page={paging.page}
            totalPages={paging.totalPages}
            from={paging.from}
            to={paging.to}
            onPageSizeChange={paging.setPageSize}
            onPageChange={paging.setPage}
          />
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
        <>
          <HistoryListTable
            rows={visibleRows}
            rowOffset={paging.offset}
            suppliers={suppliers}
            sort={histSort}
            onSortColumn={(column) => setHistSort((current) => toggleHistoryListSort(current, column))}
            onOpen={(g) => setDetail({ date: g.date, suppCode: g.suppCode })}
          />
          <div className="hist-list-groups hist-list-cards">
            {visibleRows.map((g) => {
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
          <div className="hist-list-toolbar hist-list-toolbar--bottom">
            <ReportTablePager
              alwaysShow
              totalRows={sorted.length}
              pageSize={paging.pageSize}
              page={paging.page}
              totalPages={paging.totalPages}
              from={paging.from}
              to={paging.to}
              onPageSizeChange={paging.setPageSize}
              onPageChange={paging.setPage}
            />
          </div>
        </>
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
  hCategory: string;
  setHCategory: (v: string) => void;
  hItemSearch: string;
  setHItemSearch: (v: string) => void;
  hItemCode: string;
  setHItemCode: (v: string) => void;
  items: Item[];
  itemCategories: ItemCategory[];
  datePreset: string;
  setDatePreset: (v: string) => void;
  suppliers: Supplier[];
  itemCount: number;
}) {
  const { locale, t } = useLocale();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [itemListOpen, setItemListOpen] = useState(false);
  const itemPickerRef = useRef<HTMLDivElement>(null);
  const categories = props.itemCategories.length ? props.itemCategories : FALLBACK_ITEM_CATEGORIES;
  const itemListId = "hist-item-search-list";

  const itemOptions = useMemo(() => {
    const list = props.hCategory
      ? props.items.filter((item) => item.categoryCode === props.hCategory)
      : props.items;
    const q = props.hItemSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter((item) => {
          const name = itemDisplayName(item, locale).toLowerCase();
          return (
            item.code.toLowerCase().includes(q) ||
            name.includes(q) ||
            item.nameTH.toLowerCase().includes(q) ||
            item.nameEN.toLowerCase().includes(q) ||
            item.nameKR.toLowerCase().includes(q)
          );
        })
      : list;
    return sortItemsByDisplayName(filtered, locale);
  }, [locale, props.hCategory, props.hItemSearch, props.items]);

  useEffect(() => {
    if (!itemListOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (itemPickerRef.current && !itemPickerRef.current.contains(e.target as Node)) {
        setItemListOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [itemListOpen]);

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
                className={`btn btn-secondary sort-toggle hist-preset-btn ${props.datePreset === p.id ? "active" : ""}`}
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
        <div className="filter-group grow hist-filters__category">
          <label className="lbl" htmlFor="hist-category">
            {t("hist.category")}
          </label>
          <select
            id="hist-category"
            value={props.hCategory}
            onChange={(e) => {
              const next = e.target.value;
              props.setHCategory(next);
              if (next && props.hItemCode) {
                const selected = props.items.find((item) => item.code === props.hItemCode);
                if (selected && selected.categoryCode !== next) {
                  props.setHItemCode("");
                  props.setHItemSearch("");
                }
              }
            }}
          >
            <option value="">{t("hist.categoryAll")}</option>
            {categories.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {itemCategoryDisplayName(cat, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group grow hist-filters__item-search">
          <label className="lbl" htmlFor="hist-item-search">
            {t("hist.product")}
          </label>
          <div
            ref={itemPickerRef}
            className={`hist-item-picker${itemListOpen ? " hist-item-picker--open" : ""}`}
          >
            <input
              id="hist-item-search"
              className="hist-filters__item-search-input"
              type="text"
              role="combobox"
              aria-expanded={itemListOpen}
              aria-controls={itemListOpen ? itemListId : undefined}
              aria-autocomplete="list"
              value={props.hItemSearch}
              onChange={(e) => {
                props.setHItemCode("");
                props.setHItemSearch(e.target.value);
                setItemListOpen(true);
              }}
              onFocus={() => setItemListOpen(true)}
              onClick={() => setItemListOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setItemListOpen(false);
              }}
              placeholder={t("hist.itemSearch")}
              aria-label={t("hist.itemSearch")}
              autoComplete="off"
            />
            {itemListOpen ? (
              itemOptions.length > 0 ? (
                <ul id={itemListId} className="hist-item-picker__list" role="listbox">
                  {itemOptions.map((item) => {
                    const label = itemDisplayName(item, locale);
                    const selected = props.hItemCode === item.code;
                    return (
                      <li key={item.code} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className={`hist-item-picker__option${selected ? " hist-item-picker__option--on" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            props.setHItemCode(item.code);
                            props.setHItemSearch(label);
                            setItemListOpen(false);
                          }}
                        >
                          <span className="hist-item-picker__option-label">{label}</span>
                          <span className="hist-item-picker__option-meta">{item.code}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="hist-item-picker__empty">{t("hist.itemSearchNoMatch")}</p>
              )
            ) : null}
          </div>
        </div>
        {filtersOpen && props.itemCount > 0 ? (
          <span className="hist-filters__count">{t("hist.itemsCount", { n: props.itemCount })}</span>
        ) : null}
        <div className="hist-filters__tools">
          <button
            type="button"
            className="btn btn-secondary filter-clear hist-filters__tool hist-filters__tool--icon"
            onClick={() => {
              applyPreset("today");
              props.setHSupp("");
              props.setHCategory("");
              props.setHItemSearch("");
              props.setHItemCode("");
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
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
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

