"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { apiGet } from "@/lib/api/client";
import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
import {
  buildDayOverviewFromSlips,
  type SlipDayRow,
} from "@/lib/domain/intake-day-overview";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { MessageKey } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";
import { fmt, formatAppDate, formatAppDateTime } from "@/lib/utils/format";
import type { IntakeSlipSummary, Item, ItemPurchaseUnit, Mapping, Supplier } from "@/lib/types";

type Props = {
  intakeDate: string;
  suppliers: Supplier[];
  items: Item[];
  mapping: Mapping[];
  purchaseUnits: ItemPurchaseUnit[];
  onSelectSlip: (slipId: string, suppCode: string, slipNo?: number) => void;
};

export function IntakeDayOverview({
  intakeDate,
  suppliers,
  items,
  mapping,
  purchaseUnits,
  onSelectSlip,
}: Props) {
  const { locale, t } = useLocale();
  const [slips, setSlips] = useState<IntakeSlipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDay = useCallback(async () => {
    if (!intakeDate) {
      setSlips([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const d = await apiGet<{ success: boolean; slips: IntakeSlipSummary[] }>(
        `/api/transactions/slips?dateFrom=${encodeURIComponent(intakeDate)}&dateTo=${encodeURIComponent(intakeDate)}`
      );
      if (!d.success) {
        setError(true);
        return;
      }
      setSlips(d.slips);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [intakeDate]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const overview = useMemo(
    () => buildDayOverviewFromSlips(slips, suppliers, items, mapping, purchaseUnits),
    [slips, suppliers, items, mapping, purchaseUnits]
  );

  const suppByCode = useMemo(
    () => new Map(suppliers.map((s) => [s.code, s])),
    [suppliers]
  );

  function shopName(row: SlipDayRow) {
    const supp = suppByCode.get(row.suppCode);
    return supp ? supplierDisplayName(supp, locale) : row.suppName;
  }

  if (!suppliers.length) {
    return (
      <div className="intake-document">
        <div className="intake-document__sheet">
          <p className="intake-day-overview__empty">{t("intake.dayOverview.noShops")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="intake-document intake-document--overview">
      <div className="intake-document__sheet">
        <header className="intake-doc-header intake-doc-header--overview">
          <div className="intake-doc-header__letterhead">
            <div className="intake-doc-header__title-row">
              <div className="intake-doc-header__titles">
                <p className="intake-doc-header__title-en">{t("intake.dayOverview.titleEn")}</p>
                <h2 className="intake-doc-header__title-th">{t("intake.dayOverview.title")}</h2>
              </div>
            </div>
            <div className="intake-doc-header__rule" aria-hidden />

            {loading ? (
              <IntakeLoadPanel message={t("intake.dayOverview.loading")} />
            ) : error ? (
              <div className="intake-day-overview__error-box">
                <p className="intake-day-overview__error">{t("intake.dayOverview.loadError")}</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadDay()}>
                  {t("intake.dayOverview.retry")}
                </button>
              </div>
            ) : (
              <div className="intake-doc-header__grid intake-doc-header__grid--overview">
                <div className="intake-doc-header__field">
                  <span className="intake-doc-header__label">{t("intake.slipDoc.date")}</span>
                  <span className="intake-doc-header__value">{formatAppDate(intakeDate, locale)}</span>
                </div>
                <div className="intake-doc-header__field">
                  <span className="intake-doc-header__label">{t("intake.dayOverview.slipCount")}</span>
                  <span className="intake-doc-header__value">{overview.slipCount}</span>
                </div>
                <div className="intake-doc-header__field intake-doc-header__field--total">
                  <span className="intake-doc-header__label">{t("intake.totalWon")}</span>
                  <span className="intake-doc-header__value intake-doc-header__value--amount">
                    ₩{fmt(overview.dayTotal)}
                  </span>
                </div>
                <div className="intake-doc-header__field intake-doc-header__field--wide">
                  <span className="intake-doc-header__label">{t("intake.dayOverview.savedShops")}</span>
                  <span className="intake-doc-header__value">
                    {t("intake.dayOverview.summarySlips", {
                      count: overview.slipCount,
                      shops: overview.savedShopCount,
                      total: overview.totalShopCount,
                      amount: fmt(overview.dayTotal),
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </header>

        {!loading && !error ? (
          <SavedSlipSection
            rows={overview.slips}
            shopName={shopName}
            onSelect={onSelectSlip}
            t={t}
            locale={locale}
            emptyLabel={t("intake.dayOverview.emptySlips")}
          />
        ) : null}

        <p className="intake-document__footnote">{t("intake.dayOverview.hint")}</p>
      </div>
    </div>
  );
}

function SavedSlipSection({
  rows,
  shopName,
  onSelect,
  t,
  locale,
  emptyLabel,
}: {
  rows: SlipDayRow[];
  shopName: (row: SlipDayRow) => string;
  onSelect: (slipId: string, suppCode: string, slipNo?: number) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  locale: Locale;
  emptyLabel: string;
}) {
  return (
    <section className="intake-day-slip-list" aria-label={t("intake.dayOverview.slips")}>
      {!rows.length ? (
        <p className="intake-day-slip-list__empty">{emptyLabel}</p>
      ) : (
        <ul className="intake-day-slip-list__items">
          {rows.map((row) => {
            const shopRows = rows.filter((r) => r.suppCode === row.suppCode);
            const slipNo = shopRows.length - shopRows.findIndex((r) => r.id === row.id);
            const edited = row.updatedAt !== row.createdAt;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="intake-day-slip-list__row"
                  onClick={() => onSelect(row.id, row.suppCode, slipNo)}
                >
                  <span className="intake-day-slip-list__main">
                    <span className="intake-day-slip-list__shop">{shopName(row)}</span>
                    <span className="intake-day-slip-list__slip">
                      {t("intake.slipList.slipNo", { n: slipNo })}
                    </span>
                  </span>
                  <span className="intake-day-slip-list__meta">
                    <span className="intake-day-slip-list__time">
                      {formatAppDateTime(row.createdAt, locale)}
                    </span>
                    {row.createdByName ? (
                      <span className="intake-day-slip-list__by">{row.createdByName}</span>
                    ) : null}
                    {edited ? (
                      <span className="intake-slip-tab__edited">{t("intake.slipList.editedBadge")}</span>
                    ) : null}
                  </span>
                  <span className="intake-day-slip-list__amount">₩{fmt(row.totalPrice)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
