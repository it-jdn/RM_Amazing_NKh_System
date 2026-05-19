"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { apiGet } from "@/lib/api/client";
import { IconDocument, IconPlus } from "@/components/icons/AppIcons";
import { formatAppDateTime } from "@/lib/utils/format";
import type { IntakeSlipSummary } from "@/lib/types";

type Props = {
  intakeDate: string;
  suppCode: string;
  activeSlipId: string;
  onSelectSlip: (slipId: string, slipNo: number) => void;
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

  const isNewActive = !activeSlipId;

  return (
    <div className="intake-slip-tabs" role="tablist" aria-label={t("intake.slipList.title")}>
      <button
        type="button"
        role="tab"
        aria-selected={isNewActive}
        className={`intake-slip-tab intake-slip-tab--new${isNewActive ? " intake-slip-tab--active" : ""}`}
        onClick={onNewSlip}
      >
        <IconPlus size={16} className="intake-slip-tab__icon" aria-hidden />
        <span className="intake-slip-tab__label">{t("intake.slipList.newTab")}</span>
      </button>

      {loading ? (
        <>
          <span className="intake-slip-tab intake-slip-tab--skeleton" aria-hidden />
          <span className="intake-slip-tab intake-slip-tab--skeleton" aria-hidden />
        </>
      ) : (
        slips.map((s, idx) => {
          const n = slips.length - idx;
          const active = activeSlipId === s.id;
          const edited = s.updatedAt !== s.createdAt;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`intake-slip-tab${active ? " intake-slip-tab--active" : ""}`}
              onClick={() => onSelectSlip(s.id, n)}
            >
              <IconDocument size={15} className="intake-slip-tab__doc-icon" aria-hidden />
              <span className="intake-slip-tab__label">{t("intake.slipList.slipNo", { n })}</span>
              {edited ? (
                <span
                  className="intake-slip-tab__edited"
                  title={t("intake.slipList.editedAt", {
                    at: formatAppDateTime(s.updatedAt, locale),
                  })}
                >
                  {t("intake.slipList.editedBadge")}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}
