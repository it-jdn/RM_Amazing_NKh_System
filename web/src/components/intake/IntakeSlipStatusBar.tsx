"use client";

import { DeleteIntakeBatchButton } from "@/components/intake/DeleteIntakeBatchButton";
import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
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
  loading?: boolean;
  saving?: boolean;
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
  loading,
  saving,
  reloading,
  onReload,
  onReset,
  onDeleted,
  showSavedActions,
}: Props) {
  const { locale, t } = useLocale();

  const effectiveStatus = saving ? "saving" : loading ? "loading" : status;

  const statusLabel =
    effectiveStatus === "saving"
      ? t("intake.slipStatus.saving")
      : effectiveStatus === "loading"
        ? t("intake.slipStatus.loading")
        : effectiveStatus === "saved"
          ? t("intake.slipStatus.saved")
          : effectiveStatus === "modified"
            ? t("intake.slipStatus.modified")
            : effectiveStatus === "draft"
              ? t("intake.slipStatus.draft")
              : t("intake.slipStatus.new");

  const showReload = !loading && !saving && (status !== "new" || showSavedActions);

  return (
    <div
      className={`intake-slip-bar intake-slip-bar--prominent intake-slip-bar--${effectiveStatus}`}
      role="status"
      aria-live="polite"
      aria-busy={loading || saving || undefined}
    >
      <div className="intake-slip-bar__row">
        <div className="intake-slip-bar__main-col">
          <p className="intake-slip-bar__shop">{shopName}</p>
          <div className="intake-slip-bar__status">
            <span
              className={`intake-slip-status__dot intake-slip-status__dot--${effectiveStatus}`}
              aria-hidden
            />
            <span className="intake-slip-status__text">{statusLabel}</span>
            {!loading && !saving && status !== "new" ? (
              <span className="intake-slip-bar__count">{t("intake.products", { n: productCount })}</span>
            ) : null}
          </div>
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
          {showSavedActions && !loading && !saving ? (
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

      {loading ? (
        <IntakeLoadPanel message={t("intake.slipStatus.loadingDetail")} compact />
      ) : null}

      {!loading && savedAt ? (
        <p className="intake-slip-bar__meta">
          {t("intake.savedMeta", {
            when: formatAppDateTime(savedAt, locale),
            by: savedByName || "—",
          })}
        </p>
      ) : null}

      {!loading && hasDuplicateRows ? (
        <p className="intake-slip-bar__warn">{t("intake.duplicateRowsWarning")}</p>
      ) : null}
    </div>
  );
}
