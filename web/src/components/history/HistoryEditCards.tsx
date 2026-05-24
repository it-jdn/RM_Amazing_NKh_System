"use client";

import { useLocale } from "@/context/LocaleContext";
import { itemDisplayName, itemLabel, itemSecondaryName } from "@/lib/i18n/item-name";
import type { HistoryRowVals } from "@/lib/domain/history-slip-edit";
import type { Item, TransactionRow } from "@/lib/types";
import { fmt } from "@/lib/utils/format";
import { displayNumericField } from "@/lib/utils/numeric-input";

type TableRow =
  | { kind: "rx"; txn: TransactionRow; item?: Item }
  | { kind: "empty"; item: Item };

type Props = {
  tableRows: TableRow[];
  rowVals: HistoryRowVals;
  canEdit: boolean;
  rowKeyFor: (row: TableRow) => string | null;
  onSetRow: (key: string, field: "qty" | "total", raw: string) => void;
};

export function HistoryEditCards({
  tableRows,
  rowVals,
  canEdit,
  rowKeyFor,
  onSetRow,
}: Props) {
  const { locale, t } = useLocale();

  return (
    <div className="hist-edit-cards">
      {tableRows.map((row, idx) => {
        const isRx = row.kind === "rx";
        const txn = isRx ? row.txn : undefined;
        const item = isRx ? row.item : row.item;
        const rowKey = rowKeyFor(row);
        const v = rowKey ? rowVals[rowKey] || { qty: "", total: "" } : { qty: "", total: "" };
        const qtyN = parseFloat(v.qty) || 0;
        const totalN = parseFloat(v.total) || 0;
        const unitPrice =
          qtyN > 0 && totalN > 0 ? Math.round((totalN / qtyN) * 100) / 100 : txn?.unitPrice;
        const primary = item
          ? itemDisplayName(item, locale)
          : itemLabel(null, locale, txn?.itemNameTH || txn?.itemCode);
        const secondary = item ? itemSecondaryName(item, locale) : "";
        const unit = isRx && txn ? txn.mainUnit : item?.unit || "—";
        const filled = isRx && qtyN > 0 && totalN > 0;

        return (
          <article
            key={(rowKey || item?.code || txn?.itemCode || "") + String(idx)}
            className={`hist-edit-card ${filled ? "hist-edit-card--filled" : ""} ${isRx ? "hist-edit-card--rx" : "hist-edit-card--empty"}`}
          >
            <header className="hist-edit-card__hdr">
              <span className="hist-edit-card__idx">{idx + 1}</span>
              <div className="hist-edit-card__title">
                <div className="hist-edit-card__name">{primary}</div>
                {secondary ? <div className="hist-edit-card__sub">{secondary}</div> : null}
              </div>
              <span className={`rx-badge ${isRx ? "rx-yes" : "rx-no"}`}>
                {isRx ? t("hist.received") : t("hist.notReceived")}
              </span>
            </header>

            <div className="hist-edit-card__unit-row">
              <span className="badge badge-blue">{unit}</span>
            </div>

            {isRx ? (
              <div className="hist-edit-card__fields">
                <div className="intake-field-block intake-field-block--qty">
                  <label className="intake-field-block__lbl">{t("hist.qty")}</label>
                  <div className="intake-field-block__input-wrap">
                    {canEdit && rowKey ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="next"
                        className="intake-field-block__input intake-touch-input hist-edit-card__input"
                        value={displayNumericField(v.qty)}
                        onChange={(e) => onSetRow(rowKey, "qty", e.target.value)}
                        aria-label={`${primary} ${t("hist.qty")}`}
                      />
                    ) : (
                      <span className="hist-edit-card__readonly">{fmt(txn!.qty)}</span>
                    )}
                  </div>
                </div>
                <div className="intake-field-block intake-field-block--total">
                  <label className="intake-field-block__lbl">{t("hist.value")}</label>
                  <div className="intake-field-block__input-wrap">
                    {canEdit && rowKey ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="done"
                        className="intake-field-block__input intake-touch-input hist-edit-card__input hist-edit-card__input--total"
                        value={displayNumericField(v.total)}
                        onChange={(e) => onSetRow(rowKey, "total", e.target.value)}
                        aria-label={`${primary} ${t("hist.value")}`}
                      />
                    ) : (
                      <span className="hist-edit-card__readonly hist-edit-card__readonly--total">
                        ₩{fmt(txn!.totalPrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {isRx && unitPrice != null ? (
              <footer className="hist-edit-card__foot">
                <span className="hist-edit-card__unit-price">
                  {t("hist.unitPrice")}: ₩{fmt(unitPrice)}
                </span>
              </footer>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
