"use client";

import { IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";

type Props = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function IntakeResetFormModal({ open, busy = false, onClose, onConfirm }: Props) {
  const { t } = useLocale();
  useModalLayer({ open, onClose, busy });
  if (!open) return null;

  return (
    <div
      className="modal-overlay open intake-save-confirm-overlay"
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-box intake-save-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-reset-form-title"
      >
        <div className="modal-header">
          <span id="intake-reset-form-title" className="modal-title">
            {t("intake.resetConfirmTitle")}
          </span>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t("intake.cancel")}
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p className="intake-save-confirm__intro">{t("intake.resetConfirm")}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t("intake.cancel")}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onConfirm} disabled={busy}>
            {t("intake.resetConfirmBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
