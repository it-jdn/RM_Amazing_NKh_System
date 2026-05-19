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
  slipId?: string;
  createdAt?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedByName?: string;
  productCount: number;
  hasDuplicateRows: boolean;
  role: AppRole;
  suppCode: string;
  canEdit: boolean;
  readOnly: boolean;
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
  createdAt,
  createdByName,
  updatedAt,
  updatedByName,
  productCount,
  hasDuplicateRows,
  role,
  intakeDate,
  suppCode,
  slipId,
  shopName,
  canEdit,
  readOnly,
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
        : readOnly
          ? t("intake.slipStatus.readOnly")
          : effectiveStatus === "saved"
            ? t("intake.slipStatus.saved")
            : effectiveStatus === "modified"
              ? t("intake.slipStatus.modified")
              : effectiveStatus === "draft"
                ? t("intake.slipStatus.draft")
                : t("intake.slipStatus.new");

  const showReload = !loading && !saving && (status !== "new" || showSavedActions);
  const showEditStamp = !loading && !!createdAt;
  const wasEdited = updatedAt && createdAt && updatedAt !== createdAt;

  return (
    <div
      className={`intake-slip-bar intake-slip-bar--prominent intake-slip-bar--${effectiveStatus}${readOnly ? " intake-slip-bar--readonly" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={loading || saving || undefined}
    >
      <div className="intake-slip-bar__row">
        <div className="intake-slip-bar__main-col">
          <p className="intake-slip-bar__shop">{shopName}</p>
          <div className="intake-slip-bar__status">
            <span
              className={`intake-slip-status__dot intake-slip-status__dot--${readOnly ? "readonly" : effectiveStatus}`}
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
                slipId={slipId}
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

      {showEditStamp ? (
        <div className="intake-slip-bar__audit">
          <p className="intake-slip-bar__meta">
            {t("intake.slipAudit.created", {
              when: formatAppDateTime(createdAt!, locale),
              by: createdByName || "—",
            })}
          </p>
          {wasEdited ? (
            <p className="intake-slip-bar__meta intake-slip-bar__meta--updated">
              {t("intake.slipAudit.updated", {
                when: formatAppDateTime(updatedAt!, locale),
                by: updatedByName || "—",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && hasDuplicateRows ? (
        <p className="intake-slip-bar__warn">{t("intake.duplicateRowsWarning")}</p>
      ) : null}
    </div>
  );
}
