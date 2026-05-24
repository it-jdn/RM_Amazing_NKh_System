"use client";

import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
import { useLocale } from "@/context/LocaleContext";
import { formatAppDate, formatAppDateTime, fmt } from "@/lib/utils/format";

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
  hasDuplicateRows: boolean;
  readOnly: boolean;
  loading?: boolean;
  saving?: boolean;
};

export function IntakeSlipStatusBar({
  status,
  createdAt,
  createdByName,
  updatedAt,
  intakeDate,
  slipId,
  slipNo,
  slipTotal,
  shopName,
  readOnly,
  loading,
  saving,
  hasDuplicateRows,
}: Props) {
  const { locale, t } = useLocale();

  const effectiveStatus = saving ? "saving" : loading ? "loading" : status;

  const showStatusChip =
    !readOnly &&
    effectiveStatus !== "saved" &&
    effectiveStatus !== "loading" &&
    effectiveStatus !== "saving";

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

  const wasEdited = updatedAt && createdAt && updatedAt !== createdAt;
  const showUpdatedHint = !loading && wasEdited;

  const headingTitle =
    slipId && slipNo != null
      ? t("intake.slipDoc.heading", { n: slipNo, shop: shopName })
      : t("intake.slipDoc.headingDraft", { shop: shopName });

  const showTotal = slipTotal != null && slipTotal > 0;
  const recorder = createdByName?.trim() || "—";

  return (
    <header
      className={`intake-doc-header intake-doc-header--compact intake-doc-header--slip-minimal intake-doc-header--${readOnly ? "readonly" : effectiveStatus}`}
      role="status"
      aria-live="polite"
      aria-busy={loading || saving || undefined}
    >
      <div className="intake-slip-head">
        <div className="intake-slip-head__primary">
          <h2 className="intake-slip-head__title">{headingTitle}</h2>
          {showTotal ? (
            <p className="intake-slip-head__amount" aria-label={t("intake.totalWon")}>
              <span className="intake-slip-head__amount-lbl">{t("intake.slipDoc.totalShort")}</span>
              <span className="intake-slip-head__amount-val">₩{fmt(slipTotal!)}</span>
            </p>
          ) : null}
        </div>

        <div className="intake-slip-head__secondary">
          <p className="intake-slip-head__meta">
            <span>
              {t("intake.slipDoc.dateShort")} {formatAppDate(intakeDate, locale)}
            </span>
            <span className="intake-slip-head__sep" aria-hidden>
              ·
            </span>
            <span className="intake-slip-head__recorder">{recorder}</span>
            {showUpdatedHint ? (
              <>
                <span className="intake-slip-head__sep" aria-hidden>
                  ·
                </span>
                <span className="intake-slip-head__edited">
                  {t("intake.slipAudit.updatedShort", {
                    when: formatAppDateTime(updatedAt!, locale),
                  })}
                </span>
              </>
            ) : null}
          </p>
          {showStatusChip ? (
            <span
              className={`intake-slip-head__chip intake-slip-head__chip--${effectiveStatus}`}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>

      {loading ? <IntakeLoadPanel message={t("intake.slipStatus.loadingDetail")} compact /> : null}

      {!loading && hasDuplicateRows ? (
        <p className="intake-doc-header__warn">{t("intake.duplicateRowsWarning")}</p>
      ) : null}
    </header>
  );
}
