"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { apiGet } from "@/lib/api/client";
import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
import { IconDocument } from "@/components/icons/AppIcons";
import {
  buildDayOverviewFromSlips,
  groupSlipsByShop,
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

  const shopGroups = useMemo(() => groupSlipsByShop(overview.slips), [overview.slips]);

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
            <div className="intake-doc-header__title-row intake-doc-header__title-row--overview">
              <h2 className="intake-doc-header__title-th">
                {t("intake.dayOverview.titleWithDate", {
                  date: formatAppDate(intakeDate, locale),
                })}
              </h2>
              {!loading && !error ? (
                <div className="intake-doc-header__total-block">
                  <span className="intake-doc-header__label">{t("intake.totalWon")}</span>
                  <span className="intake-doc-header__value--amount">₩{fmt(overview.dayTotal)}</span>
                </div>
              ) : null}
            </div>

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
              <div className="intake-doc-header__overview-stats">
                <div className="intake-doc-header__stat">
                  <span className="intake-doc-header__stat-value">{overview.slipCount}</span>
                  <span className="intake-doc-header__stat-label">{t("intake.dayOverview.slipCount")}</span>
                </div>
                <p className="intake-doc-header__overview-shops">
                  {t("intake.dayOverview.summaryShops", {
                    shops: overview.savedShopCount,
                    total: overview.totalShopCount,
                  })}
                </p>
              </div>
            )}
          </div>
        </header>

        {!loading && !error ? (
          <SavedSlipSection
            groups={shopGroups}
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
  groups,
  shopName,
  onSelect,
  t,
  locale,
  emptyLabel,
}: {
  groups: ReturnType<typeof groupSlipsByShop>;
  shopName: (row: SlipDayRow) => string;
  onSelect: (slipId: string, suppCode: string, slipNo?: number) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  locale: Locale;
  emptyLabel: string;
}) {
  if (!groups.length) {
    return (
      <section className="intake-day-slip-list" aria-label={t("intake.dayOverview.slips")}>
        <p className="intake-day-slip-list__empty">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className="intake-day-slip-list" aria-label={t("intake.dayOverview.slips")}>
      <div className="intake-day-shop-groups">
        {groups.map((group) => {
          const label = shopName(group.slips[0]!);
          return (
            <div key={group.suppCode} className="intake-day-shop-group">
              <div className="intake-day-shop-group__head">
                <div className="intake-day-shop-group__title-wrap">
                  <h3 className="intake-day-shop-group__shop">{label}</h3>
                  <p className="intake-day-shop-group__count">
                    {t("intake.dayOverview.shopSlipCount", { n: group.slips.length })}
                  </p>
                </div>
                <span className="intake-day-shop-group__total">₩{fmt(group.shopTotal)}</span>
              </div>
              <ul className="intake-day-shop-group__slips">
                {group.slips.map((row) => {
                  const edited = row.updatedAt !== row.createdAt;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="intake-day-slip-list__row"
                        onClick={() => onSelect(row.id, row.suppCode, row.slipNo)}
                      >
                        <span className="intake-day-slip-list__primary">
                          <span className="intake-day-slip-list__slip-label">
                            <IconDocument size={18} className="intake-day-slip-list__doc-icon" />
                            <span className="intake-day-slip-list__slip">
                              {t("intake.slipList.slipNo", { n: row.slipNo })}
                            </span>
                          </span>
                          <span className="intake-day-slip-list__amount">₩{fmt(row.totalPrice)}</span>
                        </span>
                        <span className="intake-day-slip-list__meta">
                          <span className="intake-day-slip-list__time">
                            {formatAppDateTime(row.createdAt, locale)}
                          </span>
                          {row.createdByName ? (
                            <>
                              <span className="intake-day-slip-list__sep" aria-hidden>
                                ·
                              </span>
                              <span className="intake-day-slip-list__by">{row.createdByName}</span>
                            </>
                          ) : null}
                          {edited ? (
                            <span className="intake-slip-tab__edited">{t("intake.slipList.editedBadge")}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
