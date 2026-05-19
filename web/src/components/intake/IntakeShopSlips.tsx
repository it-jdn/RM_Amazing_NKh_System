"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { apiGet } from "@/lib/api/client";
import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
import { formatAppDateTime, fmt } from "@/lib/utils/format";
import type { IntakeSlipSummary } from "@/lib/types";

type Props = {
  intakeDate: string;
  suppCode: string;
  activeSlipId: string;
  onSelectSlip: (slipId: string) => void;
  onNewSlip: () => void;
};

export function IntakeShopSlips({ intakeDate, suppCode, activeSlipId, onSelectSlip, onNewSlip }: Props) {
  const { locale, t } = useLocale();
  const [slips, setSlips] = useState<IntakeSlipSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!intakeDate || !suppCode) {
      setSlips([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await apiGet<{ success: boolean; slips: IntakeSlipSummary[] }>(
        `/api/transactions/slips?dateFrom=${encodeURIComponent(intakeDate)}&dateTo=${encodeURIComponent(intakeDate)}&suppCode=${encodeURIComponent(suppCode)}`
      );
      setSlips(d.success ? d.slips : []);
    } catch {
      setSlips([]);
    } finally {
      setLoading(false);
    }
  }, [intakeDate, suppCode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="intake-shop-slips card">
        <IntakeLoadPanel message={t("intake.slipList.loading")} />
      </div>
    );
  }

  return (
    <div className="intake-shop-slips card">
      <div className="intake-shop-slips__head">
        <h3 className="intake-shop-slips__title">{t("intake.slipList.title")}</h3>
        <button type="button" className="btn btn-primary btn-sm" onClick={onNewSlip}>
          {t("intake.slipList.new")}
        </button>
      </div>
      {!slips.length ? (
        <p className="admin-hint">{t("intake.slipList.empty")}</p>
      ) : (
        <ul className="intake-shop-slips__list">
          {slips.map((s, idx) => (
            <li key={s.id}>
              <button
                type="button"
                className={`intake-shop-slips__item${activeSlipId === s.id ? " intake-shop-slips__item--active" : ""}`}
                onClick={() => onSelectSlip(s.id)}
              >
                <span className="intake-shop-slips__item-top">
                  <span className="intake-shop-slips__num">
                    {t("intake.slipList.slipNo", { n: slips.length - idx })}
                  </span>
                  <span className="intake-shop-slips__by">{s.createdByName || "—"}</span>
                </span>
                <span className="intake-shop-slips__meta">
                  <span>{formatAppDateTime(s.createdAt, locale)}</span>
                  <span>₩{fmt(s.totalPrice)}</span>
                </span>
                {s.updatedAt !== s.createdAt ? (
                  <span className="intake-shop-slips__edited">
                    {t("intake.slipList.editedAt", { at: formatAppDateTime(s.updatedAt, locale) })}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
