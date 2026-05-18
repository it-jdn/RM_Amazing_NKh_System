"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { apiGet } from "@/lib/api/client";
import {
  aggregateDayByShop,
  type ShopDayRow,
} from "@/lib/domain/intake-day-overview";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { MessageKey } from "@/lib/i18n/messages";
import { fmt, formatAppDate } from "@/lib/utils/format";
import type { Item, ItemPurchaseUnit, Mapping, Supplier, TransactionRow } from "@/lib/types";

type Props = {
  intakeDate: string;
  suppliers: Supplier[];
  items: Item[];
  mapping: Mapping[];
  purchaseUnits: ItemPurchaseUnit[];
  onSelectShop: (suppCode: string) => void;
};

export function IntakeDayOverview({
  intakeDate,
  suppliers,
  items,
  mapping,
  purchaseUnits,
  onSelectShop,
}: Props) {
  const { locale, t } = useLocale();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDay = useCallback(async () => {
    if (!intakeDate) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const d = await apiGet<{ success: boolean; rows: TransactionRow[] }>(
        `/api/transactions?dateFrom=${encodeURIComponent(intakeDate)}&dateTo=${encodeURIComponent(intakeDate)}`
      );
      if (!d.success) {
        setError(true);
        return;
      }
      setRows(d.rows);
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
    () => aggregateDayByShop(rows, suppliers, items, mapping, purchaseUnits),
    [rows, suppliers, items, mapping, purchaseUnits]
  );

  const suppByCode = useMemo(
    () => new Map(suppliers.map((s) => [s.code, s])),
    [suppliers]
  );

  function displayName(row: ShopDayRow) {
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
          <p className="intake-day-overview__loading">{t("intake.dayOverview.loading")}</p>
        ) : error ? (
          <p className="intake-day-overview__error">{t("intake.dayOverview.loadError")}</p>
        ) : (
          <p className="intake-day-overview__summary">
            {t("intake.dayOverview.summary", {
              saved: overview.savedShopCount,
              total: overview.totalShopCount,
              amount: fmt(overview.dayTotal),
            })}
          </p>
        )}
      </div>

      {!loading && !error ? (
        <SavedShopSection
          title={t("intake.dayOverview.saved")}
          emptyLabel={t("intake.dayOverview.emptySaved")}
          rows={overview.saved}
          displayName={displayName}
          onSelect={onSelectShop}
          t={t}
        />
      ) : null}
    </div>
  );
}

function SavedShopSection({
  title,
  emptyLabel,
  rows,
  displayName,
  onSelect,
  t,
}: {
  title: string;
  emptyLabel: string;
  rows: ShopDayRow[];
  displayName: (row: ShopDayRow) => string;
  onSelect: (code: string) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <section className="intake-day-overview__section intake-day-overview__section--saved">
      <h3 className="intake-day-overview__section-title">{title}</h3>
      {!rows.length ? (
        <p className="intake-day-overview__empty">{emptyLabel}</p>
      ) : (
        <ul className="intake-day-overview__list">
          {rows.map((row) => (
            <li key={row.suppCode}>
              <button
                type="button"
                className="intake-day-overview__row"
                onClick={() => onSelect(row.suppCode)}
              >
                <span className="intake-day-overview__row-name">{displayName(row)}</span>
                <span className="intake-day-overview__row-meta">
                  <span>
                    {t("intake.dayOverview.lines", { n: row.lineCount })}
                    {row.productCount !== row.lineCount
                      ? ` · ${t("intake.dayOverview.products", { n: row.productCount })}`
                      : ""}
                  </span>
                  {row.savedByName ? (
                    <span className="intake-day-overview__saved-by">{row.savedByName}</span>
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
