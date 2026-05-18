"use client";

import { useLocale } from "@/context/LocaleContext";
import { fmt } from "@/lib/utils/format";

type Props = {
  sumCount: number;
  sumTotal: number;
  formFilled: number;
  formTotal: number;
  saving: boolean;
  shopName?: string;
  onSave: () => void;
};

export function IntakeStickyBar({
  sumCount,
  sumTotal,
  formFilled,
  formTotal,
  saving,
  shopName,
  onSave,
}: Props) {
  const { t } = useLocale();
  const saveLabel = saving ? t("intake.saving") : t("intake.saveShort");

  return (
    <div className="intake-sticky-bar" role="region" aria-label={t("intake.stickySummary")}>
      <div className="intake-sticky-bar__main">
        <div className="intake-sticky-bar__info">
          {shopName ? <p className="intake-sticky-bar__shop">{shopName}</p> : null}
          <div className="intake-sticky-bar__stats">
            <div className="intake-sticky-bar__stat intake-sticky-bar__stat--progress">
              <span className="intake-sticky-bar__stat-lbl">{t("intake.stickyFilled")}</span>
              <span className="intake-sticky-bar__stat-val">
                {formFilled}/{formTotal}
              </span>
            </div>
            <div className="intake-sticky-bar__stat">
              <span className="intake-sticky-bar__stat-lbl">{t("intake.stickyItems")}</span>
              <span className="intake-sticky-bar__stat-val">{sumCount}</span>
            </div>
            <div className="intake-sticky-bar__stat highlight">
              <span className="intake-sticky-bar__stat-lbl">{t("intake.stickyTotal")}</span>
              <span className="intake-sticky-bar__stat-val">₩{fmt(sumTotal)}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-green intake-sticky-bar__save"
          disabled={saving || sumCount === 0}
          onClick={onSave}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
