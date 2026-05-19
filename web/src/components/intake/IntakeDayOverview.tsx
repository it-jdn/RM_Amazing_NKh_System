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
  onSelectSlip: (slipId: string, suppCode: string) => void;
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

  const progressPct =
    overview.totalShopCount > 0
      ? Math.round((overview.savedShopCount / overview.totalShopCount) * 100)
      : 0;

  function shopName(row: SlipDayRow) {
    const supp = suppByCode.get(row.suppCode);
    return supp ? supplierDisplayName(supp, locale) : row.suppName;
  }

  if (!suppliers.length) {
    return (
      <div className="intake-day-overview card">
        <p className="empty">{t("intake.dayOverview.noShops")}</p>
      </div>
    );
  }

  return (
    <div className="intake-day-overview">
      <div className="intake-day-overview__header card">
        <div className="card-title">
          <span className="dot dot-green" />
          <span>{t("intake.dayOverview.title")}</span>
        </div>
        <p className="intake-day-overview__date">{formatAppDate(intakeDate, locale)}</p>

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
          <>
            <div className="intake-day-overview__kpi-row">
              <div className="intake-day-overview__kpi">
                <span className="intake-day-overview__kpi-label">{t("intake.dayOverview.slipCount")}</span>
                <span className="intake-day-overview__kpi-value">{overview.slipCount}</span>
              </div>
              <div className="intake-day-overview__kpi intake-day-overview__kpi--total">
                <span className="intake-day-overview__kpi-label">{t("intake.totalWon")}</span>
                <span className="intake-day-overview__kpi-value">₩{fmt(overview.dayTotal)}</span>
              </div>
            </div>
            <div className="intake-day-overview__progress" aria-hidden>
              <div
                className="intake-day-overview__progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="intake-day-overview__summary">
              {t("intake.dayOverview.summarySlips", {
                count: overview.slipCount,
                shops: overview.savedShopCount,
                total: overview.totalShopCount,
                amount: fmt(overview.dayTotal),
              })}
            </p>
          </>
        )}
      </div>

      {loading ? (
        <section className="intake-day-overview__section intake-day-overview__section--saved">
          <h3 className="intake-day-overview__section-title">{t("intake.dayOverview.slips")}</h3>
          <ul className="intake-day-overview__skeleton" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="intake-day-overview__skeleton-row" />
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !error ? (
        <SavedSlipSection
          title={t("intake.dayOverview.slips")}
          emptyLabel={t("intake.dayOverview.emptySlips")}
          rows={overview.slips}
          shopName={shopName}
          onSelect={onSelectSlip}
          t={t}
          locale={locale}
        />
      ) : null}
    </div>
  );
}

function SavedSlipSection({
  title,
  emptyLabel,
  rows,
  shopName,
  onSelect,
  t,
  locale,
}: {
  title: string;
  emptyLabel: string;
  rows: SlipDayRow[];
  shopName: (row: SlipDayRow) => string;
  onSelect: (slipId: string, suppCode: string) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  locale: Locale;
}) {
  return (
    <section className="intake-day-overview__section intake-day-overview__section--saved">
      <h3 className="intake-day-overview__section-title">{title}</h3>
      {!rows.length ? (
        <p className="intake-day-overview__empty">{emptyLabel}</p>
      ) : (
        <ul className="intake-day-overview__list">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="intake-day-overview__row intake-day-overview__row--saved"
                onClick={() => onSelect(row.id, row.suppCode)}
              >
                <span className="intake-day-overview__row-head">
                  <span className="intake-day-overview__row-name">{shopName(row)}</span>
                  <span className="intake-day-overview__badge">{t("intake.slipStatus.saved")}</span>
                </span>
                <span className="intake-day-overview__row-time">
                  {formatAppDateTime(row.createdAt, locale)}
                  {row.updatedAt !== row.createdAt
                    ? ` · ${t("intake.slipList.editedAt", { at: formatAppDateTime(row.updatedAt, locale) })}`
                    : ""}
                </span>
                <span className="intake-day-overview__row-meta">
                  <span>
                    {t("intake.dayOverview.lines", { n: row.lineCount })}
                    {row.productCount !== row.lineCount
                      ? ` · ${t("intake.dayOverview.products", { n: row.productCount })}`
                      : ""}
                  </span>
                  {row.createdByName ? (
                    <span className="intake-day-overview__saved-by">{row.createdByName}</span>
                  ) : null}
                  <span className="intake-day-overview__row-total">₩{fmt(row.totalPrice)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
