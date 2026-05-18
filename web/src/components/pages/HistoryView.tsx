"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { DeleteIntakeBatchButton } from "@/components/intake/DeleteIntakeBatchButton";
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { itemDisplayName, itemSecondaryName } from "@/lib/i18n/item-name";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { Supplier } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { useToast } from "@/components/Toast";
import { AppDateField } from "@/components/ui/AppDateField";
import {
  fmt,
  formatAppDate,
  formatAppDateLong,
  formatAppDateTime,
  formatAppMonthYear,
  getAppDayOfWeekShort,
  HIST_DATE_PRESETS,
  histDatePresetRange,
  todayISO,
} from "@/lib/utils/format";
import { aggregateTransactionsByItem, latestTransactionAudit } from "@/lib/domain/transactions";
import type { Locale } from "@/lib/i18n/types";
import type { AppRole, Item, TransactionRow } from "@/lib/types";

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
  const [hFrom, setHFrom] = useState(() => todayISO());
  const [hTo, setHTo] = useState(() => todayISO());
  const [hSupp, setHSupp] = useState("");
  const [datePreset, setDatePreset] = useState("today");
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
      <div className="wrap">
        <button type="button" className="detail-back" onClick={() => setDetail(null)}>
          {t("hist.back")}
        </button>
        <HistoryDetail
          date={detail.date}
          suppCode={detail.suppCode}
          histTxns={histTxns}
          items={items}
          mapping={mapping}
          role={role}
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
    <div className="wrap">
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
      />
      {sorted.length > 0 && <div className="hist-count-bar">{t("hist.itemsCount", { n: sorted.length })}</div>}
      {loading ? (
        <div className="hist-empty">{t("hist.loading")}</div>
      ) : !sorted.length ? (
        <div className="hist-empty">
          {histTxns.length > 0
            ? t("hist.emptyFiltered")
            : t("hist.empty")}
        </div>
      ) : (
        sorted.map((g) => {
          const mo = String(g.date).substring(0, 7);
          const showMonth = mo !== lastMonth;
          if (showMonth) lastMonth = mo;
          const [y, m] = mo.split("-");
          const dd = new Date(String(g.date).substring(0, 10) + "T00:00:00");
          return (
            <HistGroup
              key={g.date + g.suppCode}
              g={g}
              showMonth={showMonth}
              y={y}
              m={m}
              dd={dd}
              locale={locale}
              itemsLabel={t("hist.itemsCount", { n: g.count })}
              onOpen={() => setDetail({ date: g.date, suppCode: g.suppCode })}
            />
          );
        })
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
}) {
  const { locale, t } = useLocale();

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
    <div className="hist-filters hist-filters--stack">
      <div className="hist-presets">
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
      <div className="filter-group">
        <label className="lbl">{t("hist.dateFrom")}</label>
        <AppDateField
          id="hist-date-from"
          value={props.hFrom}
          onChange={(v) => onManualDateChange("from", v)}
          placeholder={t("hist.dateFrom")}
          aria-label={t("hist.dateFrom")}
        />
      </div>
      <div className="filter-group">
        <label className="lbl">{t("hist.dateTo")}</label>
        <AppDateField
          id="hist-date-to"
          value={props.hTo}
          onChange={(v) => onManualDateChange("to", v)}
          placeholder={t("hist.dateTo")}
          aria-label={t("hist.dateTo")}
        />
      </div>
      <div className="filter-group grow">
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
      <button
        type="button"
        className={`sort-toggle ${!props.histSortAsc ? "active" : ""}`}
        onClick={() => props.setHistSortAsc(!props.histSortAsc)}
      >
        {props.histSortAsc ? t("hist.sortOldest") : t("hist.sortNewest")}
      </button>
      <button
        type="button"
        className="filter-clear"
        onClick={() => {
          applyPreset("today");
          props.setHSupp("");
        }}
      >
        {t("hist.reset")}
      </button>
    </div>
  );
}

function HistGroup({
  g,
  showMonth,
  y,
  m,
  dd,
  locale,
  itemsLabel,
  onOpen,
}: {
  g: { date: string; suppName: string; count: number; total: number };
  showMonth: boolean;
  y: string;
  m: string;
  dd: Date;
  locale: Locale;
  itemsLabel: string;
  onOpen: () => void;
}) {
  return (
    <div>
      {showMonth && <div className="month-sep">{formatAppMonthYear(y, m, locale)}</div>}
      <div
        className="day-card day-card--tap"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}
      >
        <div className="day-card-inner">
          <div style={{ textAlign: "center", minWidth: 50 }}>
                <div className="day-date-num">{dd.getDate()}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {getAppDayOfWeekShort(dd.getDay(), locale)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="day-supp">
              {g.suppName.length > 40 ? g.suppName.substring(0, 40) + "..." : g.suppName}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatAppDate(g.date, locale)}</div>
          </div>
          <div className="day-stats">
            <span className="day-count-badge">{itemsLabel}</span>
            <span className="day-cost">₩{fmt(g.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateTitle({ date }: { date: string }) {
  return <DateTitleDiv date={date} />;
}

function DateTitleDiv({ date }: { date: string }) {
  const { locale } = useLocale();
  return (
    <div style={{ fontSize: 18, fontWeight: 700 }}>{formatAppDateLong(date, locale)}</div>
  );
}

function HistoryDetail({
  date,
  suppCode,
  histTxns,
  items,
  mapping,
  role,
  onDeleted,
}: {
  date: string;
  suppCode: string;
  histTxns: TransactionRow[];
  items: Item[];
  mapping: { suppCode: string; itemCode: string }[];
  role: AppRole;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const txns = histTxns.filter((row) => row.date === date && row.suppCode === suppCode);
  const suppName = txns[0]?.suppName || suppCode;
  const total = txns.reduce((s, row) => s + (parseFloat(String(row.totalPrice)) || 0), 0);
  const mappedCodes = mapping.filter((m) => m.suppCode === suppCode).map((m) => m.itemCode);
  const allItems = items.filter((i) => mappedCodes.includes(i.code));
  const rxMap: Record<string, TransactionRow> = {};
  aggregateTransactionsByItem(txns).forEach((row) => {
    rxMap[row.itemCode] = row;
  });
  const received = allItems.filter((i) => rxMap[i.code]);
  const allRows = [...received, ...allItems.filter((i) => !rxMap[i.code])];
  const slipAudit = latestTransactionAudit(txns);

  return (
    <>
      <div className="detail-hdr">
        <div>
          <DateTitle date={date} />
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{suppName}</div>
          {slipAudit ? (
            <div className="hist-slip-audit">
              <span>
                {t("hist.savedBy")}: {slipAudit.savedByName?.trim() || t("hist.savedByUnknown")}
              </span>
              <span>
                {t("hist.savedAt")}:{" "}
                {slipAudit.savedAt ? formatAppDateTime(slipAudit.savedAt, locale) : "—"}
              </span>
            </div>
          ) : null}
        </div>
        <div className="detail-hdr__actions">
          <DeleteIntakeBatchButton
            date={date}
            suppCode={suppCode}
            suppName={suppName}
            role={role}
            className="btn btn-danger-outline"
            onDeleted={onDeleted}
          />
          <div className="dh-cost">₩{fmt(total)}</div>
        </div>
      </div>
      <div className="tbl-scroll">
        <table className="itbl">
          <thead>
            <tr>
              <th>#</th>
              <th>{t("hist.product")}</th>
              <th>{t("hist.unit")}</th>
              <th style={{ textAlign: "right" }}>{t("hist.qty")}</th>
              <th style={{ textAlign: "right" }}>{t("hist.value")}</th>
              <th style={{ textAlign: "right" }}>{t("hist.unitPrice")}</th>
              <th>{t("hist.note")}</th>
              <th>{t("hist.savedBy")}</th>
              <th>{t("hist.savedAt")}</th>
              <th>{t("hist.status")}</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((item, idx) => {
              const txn = rxMap[item.code];
              const isRx = !!txn;
              const primary = itemDisplayName(item, locale);
              const secondary = itemSecondaryName(item, locale);
              const bg = isRx
                ? idx % 2 === 0
                  ? "#F5FCF7"
                  : "#EEF9F2"
                : idx % 2 === 0
                  ? "#FAFAFA"
                  : "#F5F5F5";
              return (
                <tr key={item.code} style={{ background: bg }}>
                  <td style={{ textAlign: "center", color: "var(--muted)" }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{primary}</div>
                    {secondary ? <div className="name-sub">{secondary}</div> : null}
                  </td>
                  <td>
                    <HistUnitCell item={item} txn={isRx ? txn : undefined} />
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontWeight: isRx ? 600 : 400,
                    }}
                  >
                    {isRx ? fmt(txn.qty) : "—"}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontWeight: 700,
                      color: "var(--green)",
                    }}
                  >
                    {isRx ? `₩${fmt(txn.totalPrice)}` : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "IBM Plex Mono, monospace" }}>
                    {isRx ? `₩${fmt(txn.unitPrice)}` : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {(isRx && txn.note) || ""}
                  </td>
                  <td className="hist-audit-cell">
                    {isRx ? txn.savedByName?.trim() || t("hist.savedByUnknown") : "—"}
                  </td>
                  <td className="hist-audit-cell hist-audit-cell--time">
                    {isRx && txn.savedAt ? formatAppDateTime(txn.savedAt, locale) : "—"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span className={`rx-badge ${isRx ? "rx-yes" : "rx-no"}`}>
                      {isRx ? t("hist.received") : t("hist.notReceived")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sum-bar" style={{ marginTop: 14 }}>
        <SumItem label={t("hist.receivedCount")} val={received.length} />
        <div className="sum-sep" />
        <SumItem label={t("hist.systemCount")} val={allItems.length} />
        <SumItem label={t("hist.totalWon")} val={`₩${fmt(total)}`} />
      </div>
    </>
  );
}

function HistUnitCell({
  item,
  txn,
}: {
  item: Item;
  txn?: TransactionRow;
}) {
  const mainUnit = txn?.mainUnit || item.unit;
  const showSub =
    item.subUnit && item.subUnit !== mainUnit && (item.convertRate ?? 1) !== 1;

  return (
    <div className="hist-unit-cell">
      <span className="badge badge-blue">{mainUnit}</span>
      {showSub ? (
        <span className="hist-unit-sub">
          {item.subUnit} ×{item.convertRate}
        </span>
      ) : null}
    </div>
  );
}

function SumItem({ label, val }: { label: string; val: string | number }) {
  return (
    <div className="sum-item">
      <div style={{ fontSize: 10, opacity: 0.7 }}>{label}</div>
      <div className="s-val">{val}</div>
    </div>
  );
}
