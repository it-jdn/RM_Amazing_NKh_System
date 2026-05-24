"use client";

import { DeleteIntakeBatchButton } from "@/components/intake/DeleteIntakeBatchButton";
import { IconRefresh } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { fmt } from "@/lib/utils/format";
import type { AppRole } from "@/lib/types";

type SlipDeleteProps = {
  date: string;
  suppCode: string;
  suppName: string;
  slipId?: string;
  role: AppRole;
  onDeleted: () => void;
};

type Props = {
  sumCount: number;
  sumTotal: number;
  formFilled: number;
  saving: boolean;
  shopName?: string;
  onSave: () => void;
  slipActions?: {
    onReset: () => void;
    delete: SlipDeleteProps;
  };
};

export function IntakeStickyBar({
  sumCount,
  sumTotal,
  formFilled,
  saving,
  onSave,
  slipActions,
}: Props) {
  const { t } = useLocale();
  const saveLabel = saving ? t("intake.saving") : t("intake.saveShort");

  return (
    <div className="intake-sticky-bar" role="region" aria-label={t("intake.stickySummary")}>
      <div className="intake-sticky-bar__main">
        <div className="intake-sticky-bar__info">
          <p className="intake-sticky-bar__filled">
            {t("intake.stickyFilledOnly", { n: formFilled })}
          </p>
          <p className="intake-sticky-bar__total-line">
            <span className="intake-sticky-bar__total-lbl">{t("intake.stickyTotal")}</span>
            <span className="intake-sticky-bar__total-val">₩{fmt(sumTotal)}</span>
          </p>
        </div>
        <div className="intake-sticky-bar__controls">
          {slipActions ? (
            <div className="intake-sticky-bar__icon-group">
              <button
                type="button"
                className="intake-sticky-bar__icon-btn"
                onClick={slipActions.onReset}
                disabled={saving}
                aria-label={t("intake.resetForm")}
                title={t("intake.resetForm")}
              >
                <IconRefresh size={15} aria-hidden />
              </button>
              <DeleteIntakeBatchButton
                date={slipActions.delete.date}
                suppCode={slipActions.delete.suppCode}
                suppName={slipActions.delete.suppName}
                slipId={slipActions.delete.slipId}
                role={slipActions.delete.role}
                onDeleted={slipActions.delete.onDeleted}
                iconOnly
                className="intake-sticky-bar__icon-btn intake-sticky-bar__icon-btn--danger"
              />
            </div>
          ) : null}
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
    </div>
  );
}
