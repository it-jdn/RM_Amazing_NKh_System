"use client";

import { DeleteIntakeBatchButton } from "@/components/intake/DeleteIntakeBatchButton";
import { IconRefresh } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { formatAppDateTime } from "@/lib/utils/format";
import type { AppRole } from "@/lib/types";

export type IntakeSlipStatus = "saved" | "modified" | "draft" | "new";

type Props = {
  status: IntakeSlipStatus;
  shopName: string;
  intakeDate: string;
  savedAt?: string;
  savedByName?: string;
  productCount: number;
  hasDuplicateRows: boolean;
  role: AppRole;
  suppCode: string;
  reloading: boolean;
  onReload: () => void;
  onReset: () => void;
  onDeleted: () => void;
  showSavedActions: boolean;
};

export function IntakeSlipStatusBar({
  status,
  savedAt,
  savedByName,
  productCount,
  hasDuplicateRows,
  role,
  intakeDate,
  suppCode,
  shopName,
  reloading,
  onReload,
  onReset,
  onDeleted,
  showSavedActions,
}: Props) {
  const { locale, t } = useLocale();

  const statusLabel =
    status === "saved"
      ? t("intake.slipStatus.saved")
      : status === "modified"
        ? t("intake.slipStatus.modified")
        : status === "draft"
          ? t("intake.slipStatus.draft")
          : t("intake.slipStatus.new");

  const showReload = status !== "new" || showSavedActions;

  return (
    <div className="intake-slip-bar" role="status" aria-live="polite">
      <div className="intake-slip-bar__row">
        <div className="intake-slip-bar__status">
          <span className={`intake-slip-status__dot intake-slip-status__dot--${status}`} aria-hidden />
          <span className="intake-slip-status__text">{statusLabel}</span>
          {status !== "new" ? (
            <span className="intake-slip-bar__count">{t("intake.products", { n: productCount })}</span>
          ) : null}
        </div>
        <div className="intake-slip-bar__tools">
          {showReload ? (
            <button
              type="button"
              className="intake-icon-btn"
              onClick={onReload}
              disabled={reloading}
              aria-label={t("intake.reloadLatest")}
              title={t("intake.reloadLatest")}
            >
              <IconRefresh size={18} className={reloading ? "intake-icon-btn__spin" : undefined} />
            </button>
          ) : null}
          {showSavedActions ? (
            <>
              <button type="button" className="intake-slip-link" onClick={onReset}>
                {t("intake.resetForm")}
              </button>
              <DeleteIntakeBatchButton
                date={intakeDate}
                suppCode={suppCode}
                suppName={shopName}
                role={role}
                className="intake-slip-link intake-slip-link--danger"
                onDeleted={onDeleted}
              />
            </>
          ) : null}
        </div>
      </div>
      {savedAt ? (
        <p className="intake-slip-bar__meta">
          {t("intake.savedMeta", {
            when: formatAppDateTime(savedAt, locale),
            by: savedByName || "—",
          })}
        </p>
      ) : null}
      {hasDuplicateRows ? <p className="intake-slip-bar__warn">{t("intake.duplicateRowsWarning")}</p> : null}
    </div>
  );
}
