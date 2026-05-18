"use client";

import { IconPlus, IconX } from "@/components/icons/AppIcons";
import { IntakePurchaseUnitSelect } from "@/components/intake/IntakePurchaseUnitSelect";
import { useLocale } from "@/context/LocaleContext";
import { itemDisplayName, itemSecondaryName } from "@/lib/i18n/item-name";
import type { Item, ItemPurchaseUnit } from "@/lib/types";
import { fmt } from "@/lib/utils/format";
import { displayNumericField } from "@/lib/utils/numeric-input";

type CurItem = Item & {
  refPrice: number;
  rowKey: string;
  mainUnitCode: string;
  purchaseOptions: ItemPurchaseUnit[];
};

type RowVals = Record<string, { qty: string; total: string }>;

type Props = {
  items: CurItem[];
  search: string;
  setSearch: (s: string) => void;
  rowVals: RowVals;
  setRow: (rowKey: string, field: "qty" | "total", val: string) => void;
  calcUp: (rowKey: string, cr: number) => string;
  onPurchaseUnitChange: (itemCode: string, mainUnitCode: string) => void;
  onOpenModal: () => void;
};

function isFilled(v: { qty: string; total: string }) {
  return (parseFloat(v.qty) || 0) > 0 && (parseFloat(v.total) || 0) > 0;
}

export function IntakeItemCards({
  items,
  search,
  setSearch,
  rowVals,
  setRow,
  calcUp,
  onPurchaseUnitChange,
  onOpenModal,
}: Props) {
  const { locale, t } = useLocale();

  return (
    <div className="intake-cards-wrap">
      <div className="intake-cards-toolbar intake-cards-toolbar--sticky">
        <div className="intake-cards-toolbar__head">
          <div className="intake-search-field">
            <input
              type="search"
              placeholder={t("intake.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="intake-search-input intake-search-input--mobile"
              enterKeyHint="search"
            />
            {search ? (
              <button
                type="button"
                className="intake-search-clear"
                onClick={() => setSearch("")}
                aria-label={t("intake.clearSearch")}
              >
                <IconX size={16} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="intake-add-product-btn"
            onClick={onOpenModal}
            aria-label={t("intake.addProduct")}
            title={t("intake.addProduct")}
          >
            <IconPlus size={20} />
          </button>
        </div>
      </div>

      <div className="intake-item-cards">
        {items.map((it, idx) => {
          const v = rowVals[it.rowKey] || { qty: "", total: "" };
          const filled = isFilled(v);
          const primary = itemDisplayName(it, locale);
          const secondary = itemSecondaryName(it, locale);

          return (
            <article key={it.rowKey} className={`intake-item-card ${filled ? "filled" : ""}`}>
              <header className="intake-item-card__hdr">
                <span className="intake-item-card__idx">{idx + 1}</span>
                <div className="intake-item-card__title">
                  <div className="intake-item-card__name">{primary}</div>
                  {secondary ? <div className="intake-item-card__sub">{secondary}</div> : null}
                </div>
              </header>

              {it.purchaseOptions.length > 1 ? (
                <div className="intake-item-card__unit-row">
                  <span className="intake-item-card__unit-lbl">{t("intake.purchaseUnit")}</span>
                  <IntakePurchaseUnitSelect
                    options={it.purchaseOptions}
                    valueMainUnitCode={it.mainUnitCode}
                    onChange={(code) => onPurchaseUnitChange(it.code, code)}
                  />
                </div>
              ) : null}

              <div className="intake-item-card__fields">
                <div className="intake-field-block">
                  <label className="intake-field-block__lbl">{t("intake.qty")}</label>
                  <div className="intake-field-block__input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="next"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="intake-field-block__input intake-touch-input"
                      value={displayNumericField(v.qty)}
                      onChange={(e) => setRow(it.rowKey, "qty", e.target.value)}
                    />
                    <span className="intake-field-block__suffix">{it.unit}</span>
                  </div>
                </div>
                <div className="intake-field-block intake-field-block--total">
                  <label className="intake-field-block__lbl">{t("intake.totalPrice")}</label>
                  <div className="intake-field-block__input-wrap">
                    <span className="intake-field-block__prefix" aria-hidden>
                      ₩
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="intake-field-block__input intake-touch-input intake-field-block__input--total"
                      value={displayNumericField(v.total)}
                      onChange={(e) => setRow(it.rowKey, "total", e.target.value)}
                    />
                  </div>
                  {it.refPrice > 0 ? (
                    <span className="intake-ref-price">
                      {t("intake.refPrice", { price: fmt(it.refPrice), unit: it.unit })}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="intake-item-card__meta">
                <span className="badge badge-gray">
                  {it.subUnit} ×{it.convertRate}
                </span>
                <span className="intake-item-card__unit-price">
                  {t("intake.unitPrice")}: {calcUp(it.rowKey, it.convertRate)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
