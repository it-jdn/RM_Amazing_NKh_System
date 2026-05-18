"use client";

import { IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";
import { fmt, formatAppDate } from "@/lib/utils/format";

type Props = {
  open: boolean;
  saving: boolean;
  intakeDate: string;
  shopName: string;
  itemCount: number;
  total: number;
  replacingExisting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function IntakeSaveConfirmModal({
  open,
  saving,
  intakeDate,
  shopName,
  itemCount,
  total,
  replacingExisting,
  onClose,
  onConfirm,
}: Props) {
  const { locale, t } = useLocale();
  useModalLayer({ open, onClose, busy: saving });
  if (!open) return null;

  return (
    <div
      className="modal-overlay open intake-save-confirm-overlay"
      onClick={(e) => {
        if (!saving && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box intake-save-confirm" role="dialog" aria-modal="true" aria-labelledby="intake-save-confirm-title">
        <div className="modal-header">
          <span id="intake-save-confirm-title" className="modal-title">
            {t("intake.confirmSaveTitle")}
          </span>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label={t("intake.cancel")}
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p className="intake-save-confirm__intro">{t("intake.confirmSaveIntro")}</p>
          <dl className="intake-save-confirm__summary">
            <div className="intake-save-confirm__row">
              <dt>{t("intake.date")}</dt>
              <dd>{formatAppDate(intakeDate, locale)}</dd>
            </div>
            <div className="intake-save-confirm__row">
              <dt>{t("intake.supplier")}</dt>
              <dd>{shopName}</dd>
            </div>
            <div className="intake-save-confirm__row">
              <dt>{t("intake.confirmSaveItemsLabel")}</dt>
              <dd>{t("intake.confirmSaveItems", { n: itemCount })}</dd>
            </div>
            <div className="intake-save-confirm__row intake-save-confirm__row--total">
              <dt>{t("intake.totalWon")}</dt>
              <dd>₩{fmt(total)}</dd>
            </div>
          </dl>
          <p className="intake-save-confirm__note">{t("intake.confirmSaveBlankNote")}</p>
          {replacingExisting ? (
            <p className="intake-save-confirm__warn">{t("intake.confirmSaveReplace")}</p>
          ) : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {t("intake.cancel")}
          </button>
          <button type="button" className="btn btn-green" onClick={onConfirm} disabled={saving}>
            {saving ? t("intake.saving") : t("intake.confirmSaveBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
