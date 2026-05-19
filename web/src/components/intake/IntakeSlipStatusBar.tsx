"use client";

import { DeleteIntakeBatchButton } from "@/components/intake/DeleteIntakeBatchButton";
import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
import { useLocale } from "@/context/LocaleContext";
import { formatAppDate, formatAppDateTime, fmt } from "@/lib/utils/format";
import type { AppRole } from "@/lib/types";

export type IntakeSlipStatus = "saved" | "modified" | "draft" | "new";

type Props = {
  status: IntakeSlipStatus;
  shopName: string;
  intakeDate: string;
  slipId?: string;
  slipNo?: number;
  slipTotal?: number;
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
  slipNo,
  slipTotal,
  shopName,
  readOnly,
  loading,
  saving,
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

  const showEditStamp = !loading && !!createdAt;
  const wasEdited = updatedAt && createdAt && updatedAt !== createdAt;

  const docNoLabel =
    slipId && slipNo != null ? t("intake.slipDoc.no", { n: slipNo }) : t("intake.slipDoc.draft");

  const showTotal = slipTotal != null && slipTotal > 0;

  return (
    <header
      className={`intake-doc-header intake-doc-header--compact intake-doc-header--${readOnly ? "readonly" : effectiveStatus}`}
      role="status"
      aria-live="polite"
      aria-busy={loading || saving || undefined}
    >
      <div className="intake-doc-header__letterhead">
        <div className="intake-doc-header__title-row">
          <div className="intake-doc-header__titles">
            <h2 className="intake-doc-header__title-th">
              {t("intake.slipDoc.title")}
              <span className="intake-doc-header__shop-inline"> — {shopName}</span>
            </h2>
          </div>
          <div className="intake-doc-header__actions">
            {showTotal ? (
              <div className="intake-doc-header__total-block">
                <span className="intake-doc-header__label">{t("intake.totalWon")}</span>
                <span className="intake-doc-header__value--amount">₩{fmt(slipTotal!)}</span>
              </div>
            ) : null}
            {!loading && !saving ? (
              <div className="intake-doc-header__tools">
                {showSavedActions ? (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm intake-doc-header__tool" onClick={onReset}>
                      {t("intake.resetForm")}
                    </button>
                    <DeleteIntakeBatchButton
                      date={intakeDate}
                      suppCode={suppCode}
                      suppName={shopName}
                      slipId={slipId}
                      role={role}
                      className="btn btn-danger-outline btn-sm intake-doc-header__tool"
                      onDeleted={onDeleted}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
            <span
              className={`intake-doc-header__badge intake-doc-header__badge--${readOnly ? "readonly" : effectiveStatus}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="intake-doc-header__meta-row">
          <span className="intake-doc-header__meta-item">
            <span className="intake-doc-header__label">{t("intake.slipDoc.docNo")}</span>
            <span className="intake-doc-header__value intake-doc-header__value--mono">{docNoLabel}</span>
          </span>
          <span className="intake-doc-header__meta-item">
            <span className="intake-doc-header__label">{t("intake.slipDoc.date")}</span>
            <span className="intake-doc-header__value">{formatAppDate(intakeDate, locale)}</span>
          </span>
          <span className="intake-doc-header__meta-item">
            <span className="intake-doc-header__label">{t("intake.slipDoc.recorder")}</span>
            <span className="intake-doc-header__value">{createdByName || "—"}</span>
          </span>
          {!showTotal ? (
            <span className="intake-doc-header__meta-item">
              <span className="intake-doc-header__label">{t("intake.products")}</span>
              <span className="intake-doc-header__value">
                {loading || saving ? "…" : t("intake.products", { n: productCount })}
              </span>
            </span>
          ) : null}
        </div>

        {showEditStamp ? (
          <div className="intake-doc-header__stamps intake-doc-header__stamps--compact">
            <p className="intake-doc-header__stamp">
              {t("intake.slipAudit.created", {
                when: formatAppDateTime(createdAt!, locale),
                by: createdByName || "—",
              })}
            </p>
            {wasEdited ? (
              <p className="intake-doc-header__stamp intake-doc-header__stamp--updated">
                {t("intake.slipAudit.updated", {
                  when: formatAppDateTime(updatedAt!, locale),
                  by: updatedByName || "—",
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? <IntakeLoadPanel message={t("intake.slipStatus.loadingDetail")} compact /> : null}

      {!loading && hasDuplicateRows ? (
        <p className="intake-doc-header__warn">{t("intake.duplicateRowsWarning")}</p>
      ) : null}
    </header>
  );
}
