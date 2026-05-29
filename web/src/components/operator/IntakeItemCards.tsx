"use client";

import { IconPlus, IconX } from "@/components/icons/AppIcons";
import { IntakePurchaseUnitSuffix } from "@/components/intake/IntakePurchaseUnitSelect";
import { useLocale } from "@/context/LocaleContext";
import { unitConversionMessageParams } from "@/lib/domain/intake-unit-conversion";
import { itemDisplayName } from "@/lib/i18n/item-name";
import type { Item, ItemPurchaseUnit, UnitOption } from "@/lib/types";
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
  units: UnitOption[];
  search: string;
  setSearch: (s: string) => void;
  rowVals: RowVals;
  setRow: (rowKey: string, field: "qty" | "total", val: string) => void;
  calcUp: (rowKey: string, cr: number) => string;
  onPurchaseUnitChange: (itemCode: string, mainUnitCode: string) => void;
  onOpenModal: () => void;
  readOnly?: boolean;
};

function isFilled(v: { qty: string; total: string }) {
  return (parseFloat(v.qty) || 0) > 0 && (parseFloat(v.total) || 0) > 0;
}

export function IntakeItemCards({
  items,
  units,
  search,
  setSearch,
  rowVals,
  setRow,
  calcUp,
  onPurchaseUnitChange,
  onOpenModal,
  readOnly = false,
}: Props) {
  const { locale, t } = useLocale();

  return (
    <div className="intake-cards-wrap">
      <div className="intake-cards-toolbar intake-cards-toolbar--sticky">
        <div className="intake-cards-toolbar__head">
          <div className="intake-search-field">
            <input
              type="text"
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
            disabled={readOnly}
            aria-label={t("intake.addProduct")}
            title={t("intake.addProduct")}
          >
            <IconPlus size={18} />
          </button>
        </div>
      </div>

      <div className="intake-item-cards">
        {items.map((it, idx) => {
          const v = rowVals[it.rowKey] || { qty: "", total: "" };
          const filled = isFilled(v);
          const primary = itemDisplayName(it, locale);
          const hasConversion =
            Boolean(it.subUnit?.trim()) &&
            it.subUnit.trim() !== it.unit.trim() &&
            Number(it.convertRate) > 0 &&
            Number(it.convertRate) !== 1;
          const conversionText = hasConversion
            ? t("intake.unitConversion", unitConversionMessageParams(it.unit, it.subUnit, it.convertRate))
            : null;

          return (
            <article key={it.rowKey} className={`intake-item-card ${filled ? "filled" : ""}`}>
              <header className="intake-item-card__hdr">
                <span className="intake-item-card__idx">{idx + 1}</span>
                <div className="intake-item-card__title">
                  <div className="intake-item-card__name intake-item-card__name--single" title={primary}>
                    {primary}
                  </div>
                </div>
                <span className="intake-item-card__code">{it.code}</span>
              </header>

              <div className="intake-item-card__fields">
                <div className="intake-field-block intake-field-block--qty">
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
                      disabled={readOnly}
                      readOnly={readOnly}
                    />
                    <IntakePurchaseUnitSuffix
                      options={it.purchaseOptions}
                      valueMainUnitCode={it.mainUnitCode}
                      units={units}
                      onChange={(code) => onPurchaseUnitChange(it.code, code)}
                      disabled={readOnly}
                    />
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
                      disabled={readOnly}
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              </div>

              <footer className="intake-item-card__foot">
                {conversionText ? (
                  <span className="intake-item-card__foot-convert">{conversionText}</span>
                ) : (
                  <span className="intake-item-card__foot-convert" aria-hidden />
                )}
                <span className="intake-item-card__foot-unit-price">
                  {t("intake.unitPrice")}: {calcUp(it.rowKey, it.convertRate)}
                </span>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
