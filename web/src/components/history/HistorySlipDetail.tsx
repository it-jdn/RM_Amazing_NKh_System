"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPrint } from "@/components/icons/AppIcons";
import { HistoryEditCards } from "@/components/history/HistoryEditCards";
import { HistoryStickyFooter } from "@/components/history/HistoryStickyFooter";
import { DeleteIntakeBatchButton } from "@/components/intake/DeleteIntakeBatchButton";
import { apiGet, apiPost } from "@/lib/api/client";
import { apiSucceeded } from "@/lib/api/success";
import { useAppData } from "@/context/AppDataContext";
import { useLocale } from "@/context/LocaleContext";
import { supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import { useToast } from "@/components/Toast";
import {
  buildHistoryTransactions,
  historyRowsToVals,
  isHistoryValsDirty,
  slipNoteForSave,
  type HistoryRowVals,
} from "@/lib/domain/history-slip-edit";
import { intakeRowKey } from "@/lib/domain/intake-row-key";
import { itemDisplayName, itemLabel, itemSecondaryName } from "@/lib/i18n/item-name";
import {
  fmt,
  formatAppDate,
  formatAppDateLong,
  formatAppDateTime,
} from "@/lib/utils/format";
import {
  buildHistorySlipPrintHtml,
  openHistorySlipPrintDocument,
} from "@/lib/history/print-history-slip-document";
import { displayNumericField, sanitizeDecimalInput } from "@/lib/utils/numeric-input";
import type {
  AppRole,
  IntakeSlipSummaryWithEdit,
  Item,
  Mapping,
  TransactionRow,
} from "@/lib/types";

type Props = {
  date: string;
  suppCode: string;
  histTxns: TransactionRow[];
  items: Item[];
  mapping: Mapping[];
  role: AppRole;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
};

function DateTitle({ date }: { date: string }) {
  const { locale } = useLocale();
  return <div className="hist-detail-date">{formatAppDateLong(date, locale)}</div>;
}

export function HistorySlipDetail({
  date,
  suppCode,
  histTxns,
  items,
  mapping,
  role,
  onSaved,
  onDeleted,
}: Props) {
  const { locale, t } = useLocale();
  const { suppliers } = useAppData();
  const toast = useToast();

  const [slips, setSlips] = useState<IntakeSlipSummaryWithEdit[]>([]);
  const [legacyCanEdit, setLegacyCanEdit] = useState(false);
  const [legacyMode, setLegacyMode] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);

  const dayTxns = useMemo(
    () => histTxns.filter((r) => r.date === date && r.suppCode === suppCode),
    [histTxns, date, suppCode]
  );

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const d = await apiGet<{
        success: boolean;
        slips: IntakeSlipSummaryWithEdit[];
        legacy?: { canEdit: boolean; lineCount: number };
      }>(
        `/api/transactions/slips?dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(date)}&suppCode=${encodeURIComponent(suppCode)}`
      );
      if (!d.success) return;
      setSlips(d.slips);
      if (d.slips.length > 0) {
        setLegacyMode(false);
        setSelectedSlipId((prev) =>
          prev && d.slips.some((s) => s.id === prev) ? prev : d.slips[0]!.id
        );
      } else if (d.legacy?.lineCount) {
        setLegacyMode(true);
        setLegacyCanEdit(d.legacy.canEdit);
        setSelectedSlipId("");
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMeta(false);
    }
  }, [date, suppCode]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const activeSlip = slips.find((s) => s.id === selectedSlipId);
  const slipRows = useMemo(() => {
    if (legacyMode) return dayTxns.filter((r) => !r.slipId);
    if (!selectedSlipId) return [];
    return dayTxns.filter((r) => r.slipId === selectedSlipId);
  }, [legacyMode, dayTxns, selectedSlipId]);

  const canEdit = legacyMode ? legacyCanEdit : Boolean(activeSlip?.canEdit);
  const suppNameSnapshot = activeSlip?.suppName || slipRows[0]?.suppName || suppCode;
  const suppName = supplierDisplayNameByCode(
    suppCode,
    suppliers,
    locale,
    suppNameSnapshot
  );
  const slipNote = activeSlip?.slipNote ?? slipNoteForSave("", slipRows);

  const mappedCodes = mapping.filter((m) => m.suppCode === suppCode).map((m) => m.itemCode);
  const allItems = items.filter((i) => mappedCodes.includes(i.code));

  const itemByCode = useMemo(() => new Map(allItems.map((i) => [i.code, i])), [allItems]);

  const tableRows = useMemo(() => {
    const rx = slipRows.map((txn) => ({
      kind: "rx" as const,
      txn,
      item: itemByCode.get(txn.itemCode),
    }));
    const empty = allItems
      .filter((i) => !slipRows.some((r) => r.itemCode === i.code))
      .map((item) => ({ kind: "empty" as const, item }));
    return [...rx, ...empty];
  }, [slipRows, allItems, itemByCode]);

  const receivedCount = slipRows.length;

  const [rowVals, setRowVals] = useState<HistoryRowVals>({});
  const [baselineVals, setBaselineVals] = useState<HistoryRowVals>({});

  useEffect(() => {
    const vals = historyRowsToVals(slipRows);
    setRowVals(vals);
    setBaselineVals(vals);
  }, [slipRows]);

  const dirty = isHistoryValsDirty(rowVals, baselineVals);
  const total = useMemo(() => {
    let sum = 0;
    for (const v of Object.values(rowVals)) {
      sum += parseFloat(v.total) || 0;
    }
    return sum;
  }, [rowVals]);

  function setRow(key: string, field: "qty" | "total", raw: string) {
    const val = sanitizeDecimalInput(raw);
    setRowVals((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { qty: "", total: "" }), [field]: val },
    }));
  }

  const createdBy = activeSlip?.createdByName || slipRows[0]?.savedByName;
  const createdAt = activeSlip?.createdAt || slipRows[0]?.savedAt;
  const updatedBy = activeSlip?.updatedByName?.trim();
  const updatedAt = activeSlip?.updatedAt;
  const showUpdated =
    Boolean(updatedBy) &&
    (updatedAt !== createdAt || updatedBy !== createdBy);

  function handlePrintPdf() {
    if (loadingMeta) return;
    const rxLines = tableRows.filter((r) => r.kind === "rx");
    if (!rxLines.length) {
      toast(t("intake.toastNeedItem"));
      return;
    }

    const lines = rxLines.map((row, i) => {
      const txn = row.txn;
      const item = row.item;
      const rowKey = intakeRowKey(txn.itemCode, txn.mainUnit);
      const v = rowVals[rowKey] || { qty: "", total: "" };
      const qtyN = parseFloat(v.qty) || txn.qty;
      const totalN = parseFloat(v.total) || txn.totalPrice;
      const unitPrice =
        qtyN > 0 && totalN > 0
          ? Math.round((totalN / qtyN) * 100) / 100
          : txn.unitPrice;
      const primary = item
        ? itemDisplayName(item, locale)
        : itemLabel(null, locale, txn.itemNameTH || txn.itemCode);
      const secondary = item ? itemSecondaryName(item, locale) : "";
      return {
        index: i + 1,
        product: primary,
        productSub: secondary || undefined,
        unit: txn.mainUnit,
        qty: fmt(qtyN),
        total: `₩${fmt(totalN)}`,
        unitPrice: unitPrice != null ? `₩${fmt(unitPrice)}` : "—",
      };
    });

    const slipNoLabel =
      activeSlip != null
        ? t("intake.slipList.slipNo", { n: activeSlip.slipNo })
        : legacyMode
          ? t("hist.slipTabs")
          : "—";

    const html = buildHistorySlipPrintHtml({
      brandName: "Amazing Nongkhai",
      heading: `${t("intake.slipDoc.title")} — ${suppName}`,
      shopName: suppName,
      dateText: formatAppDateLong(date, locale),
      docNoText: slipNoLabel,
      recorderText: createdBy?.trim() || t("hist.savedByUnknown"),
      savedAtText: createdAt ? formatAppDateTime(createdAt, locale) : "—",
      updatedByText: showUpdated ? updatedBy || "—" : undefined,
      updatedAtText: showUpdated && updatedAt ? formatAppDateTime(updatedAt, locale) : undefined,
      noteText: slipNote || undefined,
      lines,
      receivedCount,
      totalText: `₩${fmt(total)}`,
      labels: {
        docTitle: t("intake.slipDoc.title"),
        docTitleEn: t("intake.slipDoc.titleEn"),
        shop: t("intake.slipDoc.shop"),
        date: t("intake.slipDoc.date"),
        docNo: t("intake.slipDoc.docNo"),
        recorder: t("intake.slipDoc.recorder"),
        savedAt: t("hist.savedAt"),
        updatedBy: t("hist.updatedBy"),
        updatedAt: t("hist.updatedAt"),
        note: t("hist.note"),
        colNo: "#",
        colProduct: t("hist.product"),
        colUnit: t("hist.unit"),
        colQty: t("hist.qty"),
        colValue: t("hist.value"),
        colUnitPrice: t("hist.unitPrice"),
        receivedCount: t("hist.receivedCount"),
        totalWon: t("hist.totalWon"),
      },
    });

    if (!openHistorySlipPrintDocument(html)) {
      toast(t("hist.printPdfBlocked"));
    }
  }

  async function handleSave() {
    if (!canEdit) {
      toast(t("intake.readOnlyHint"));
      return;
    }
    const txns = buildHistoryTransactions(
      rowVals,
      slipRows,
      items,
      mapping,
      date,
      suppCode,
      suppName,
      slipNote
    );
    if (!txns.length) {
      toast(t("intake.toastNeedItem"));
      return;
    }
    setSaving(true);
    try {
      if (legacyMode) {
        const r = await apiPost<{ success?: boolean; message: string }>("/api/transactions/replace", {
          date,
          suppCode,
          transactions: txns,
        });
        toast(r.message);
        if (apiSucceeded(r)) {
          await onSaved();
          await loadMeta();
        }
        return;
      }
      const r = await apiPost<{ success?: boolean; message: string }>("/api/transactions", {
        transactions: txns,
        slipId: selectedSlipId,
        slipNote,
      });
      toast(r.message);
      if (apiSucceeded(r)) {
        await onSaved();
        await loadMeta();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function rowKeyFor(row: { kind: "rx" | "empty"; txn?: TransactionRow }) {
    if (row.kind !== "rx" || !row.txn) return null;
    return intakeRowKey(row.txn.itemCode, row.txn.mainUnit);
  }

  return (
    <div className="hist-detail-panel">
      <div className="detail-hdr hist-detail-hdr">
        <div className="hist-detail-hdr__top">
          <div className="hist-detail-head">
            <DateTitle date={date} />
            <h2 className="hist-detail-shop">{suppName}</h2>
            {slips.length > 1 ? (
              <div className="hist-slip-tabs" role="tablist" aria-label={t("hist.slipTabs")}>
                {slips.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedSlipId === s.id}
                    className={`hist-slip-tabs__btn ${selectedSlipId === s.id ? "hist-slip-tabs__btn--active" : ""}`}
                    onClick={() => setSelectedSlipId(s.id)}
                  >
                    {t("intake.slipList.slipNo", { n: s.slipNo })}
                  </button>
                ))}
              </div>
            ) : activeSlip ? (
              <p className="hist-detail-slip-label">
                {t("intake.slipList.slipNo", { n: activeSlip.slipNo })}
              </p>
            ) : legacyMode ? (
              <p className="hist-detail-slip-label">{t("hist.slipTabs")}</p>
            ) : null}
          </div>
          <div className="hist-detail-hdr__aside">
            <div className="hist-detail-hdr__total" aria-label={t("hist.totalWon")}>
              ₩{fmt(total)}
            </div>
            <div className="hist-detail-hdr__actions">
              <button
                type="button"
                className="hist-detail-hdr__icon-btn"
                disabled={loadingMeta || receivedCount === 0}
                onClick={handlePrintPdf}
                aria-label={t("hist.printPdf")}
                title={t("hist.printPdf")}
              >
                <IconPrint size={18} aria-hidden />
              </button>
              <DeleteIntakeBatchButton
                date={date}
                suppCode={suppCode}
                suppName={suppName}
                slipId={legacyMode ? undefined : selectedSlipId || undefined}
                role={role}
                iconOnly
                className="hist-detail-hdr__icon-btn hist-detail-hdr__icon-btn--danger"
                onDeleted={onDeleted}
              />
            </div>
          </div>
        </div>
        <dl className="hist-detail-audit hist-detail-audit--desktop">
          <div className="hist-detail-audit__row">
            <dt>{t("hist.savedBy")}</dt>
            <dd>{createdBy?.trim() || t("hist.savedByUnknown")}</dd>
          </div>
          <div className="hist-detail-audit__row">
            <dt>{t("hist.savedAt")}</dt>
            <dd>{createdAt ? formatAppDateTime(createdAt, locale) : "—"}</dd>
          </div>
          {showUpdated ? (
            <>
              <div className="hist-detail-audit__row">
                <dt>{t("hist.updatedBy")}</dt>
                <dd>{updatedBy}</dd>
              </div>
              <div className="hist-detail-audit__row">
                <dt>{t("hist.updatedAt")}</dt>
                <dd>{updatedAt ? formatAppDateTime(updatedAt, locale) : "—"}</dd>
              </div>
            </>
          ) : null}
        </dl>
        <p className="hist-detail-meta hist-detail-meta--mobile">
          <span>
            {t("intake.slipDoc.dateShort")} {formatAppDate(date, locale)}
          </span>
          <span className="hist-detail-meta__sep" aria-hidden>
            ·
          </span>
          <span className="hist-detail-meta__who">
            {createdBy?.trim() || t("hist.savedByUnknown")}
          </span>
          {showUpdated && updatedAt ? (
            <>
              <span className="hist-detail-meta__sep" aria-hidden>
                ·
              </span>
              <span className="hist-detail-meta__edited">
                {t("intake.slipAudit.updatedShort", {
                  when: formatAppDateTime(updatedAt, locale),
                })}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="hist-detail-body">
      {!canEdit ? (
        <p className="hist-readonly-banner" role="status">
          {t("intake.readOnlyBanner")}
        </p>
      ) : null}

      <div className="hist-mobile-only">
        <HistoryEditCards
          tableRows={tableRows}
          rowVals={rowVals}
          canEdit={canEdit}
          rowKeyFor={rowKeyFor}
          onSetRow={setRow}
        />
      </div>

      <div className="tbl-scroll hist-desktop-only">
        <table className="itbl hist-edit-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t("hist.product")}</th>
              <th>{t("hist.unit")}</th>
              <th style={{ textAlign: "right" }}>{t("hist.qty")}</th>
              <th style={{ textAlign: "right" }}>{t("hist.value")}</th>
              <th style={{ textAlign: "right" }}>{t("hist.unitPrice")}</th>
              <th>{t("hist.status")}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => {
              const isRx = row.kind === "rx";
              const txn = isRx ? row.txn : undefined;
              const item = isRx ? row.item : row.item;
              const rowKey =
                isRx && txn ? intakeRowKey(txn.itemCode, txn.mainUnit) : null;
              const v = rowKey ? rowVals[rowKey] || { qty: "", total: "" } : { qty: "", total: "" };
              const qtyN = parseFloat(v.qty) || 0;
              const totalN = parseFloat(v.total) || 0;
              const unitPrice =
                qtyN > 0 && totalN > 0 ? Math.round((totalN / qtyN) * 100) / 100 : txn?.unitPrice;
              const primary = item
                ? itemDisplayName(item, locale)
                : itemLabel(null, locale, txn?.itemNameTH || txn?.itemCode);
              const secondary = item ? itemSecondaryName(item, locale) : "";
              const bg = isRx
                ? idx % 2 === 0
                  ? "#F5FCF7"
                  : "#EEF9F2"
                : idx % 2 === 0
                  ? "#FAFAFA"
                  : "#F5F5F5";

              return (
                <tr
                  key={(rowKey || item?.code || txn?.itemCode || "") + String(idx)}
                  style={{ background: bg }}
                >
                  <td style={{ textAlign: "center", color: "var(--muted)" }}>{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{primary}</div>
                    {secondary ? <div className="name-sub">{secondary}</div> : null}
                  </td>
                  <td>
                    {isRx && txn ? (
                      <span className="badge badge-blue">{txn.mainUnit}</span>
                    ) : item ? (
                      <span className="badge badge-blue">{item.unit}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hist-edit-table__num">
                    {isRx && canEdit && rowKey ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="hist-edit-input"
                        value={displayNumericField(v.qty)}
                        onChange={(e) => setRow(rowKey, "qty", e.target.value)}
                        aria-label={`${primary} ${t("hist.qty")}`}
                      />
                    ) : isRx ? (
                      fmt(txn!.qty)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hist-edit-table__num hist-edit-table__num--total">
                    {isRx && canEdit && rowKey ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="hist-edit-input hist-edit-input--total"
                        value={displayNumericField(v.total)}
                        onChange={(e) => setRow(rowKey, "total", e.target.value)}
                        aria-label={`${primary} ${t("hist.value")}`}
                      />
                    ) : isRx ? (
                      `₩${fmt(txn!.totalPrice)}`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="hist-edit-table__num" style={{ color: "var(--muted)" }}>
                    {isRx && unitPrice != null ? `₩${fmt(unitPrice)}` : "—"}
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

      <div className="hist-detail-footer hist-desktop-only">
        <div className="hist-detail-footer__bar">
          <div className="hist-detail-footer__stat">
            <span className="hist-detail-footer__lbl">{t("hist.receivedCount")}</span>
            <span className="hist-detail-footer__val">{receivedCount}</span>
          </div>
          {canEdit ? (
            <button
              type="button"
              className="btn btn-primary hist-detail-footer__save"
              disabled={saving || loadingMeta || !dirty}
              onClick={() => void handleSave()}
            >
              {saving ? t("hist.saving") : t("hist.saveChanges")}
            </button>
          ) : null}
        </div>
      </div>
      </div>

      <HistoryStickyFooter
        receivedCount={receivedCount}
        canEdit={canEdit}
        dirty={dirty}
        saving={saving}
        loadingMeta={loadingMeta}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
