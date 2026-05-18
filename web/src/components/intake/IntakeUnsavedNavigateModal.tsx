"use client";

import { IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";

type Props = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
};

export function IntakeUnsavedNavigateModal({ open, saving, onClose, onSave, onDiscard }: Props) {
  const { t } = useLocale();
  useModalLayer({ open, onClose, busy: saving });
  if (!open) return null;

  return (
    <div
      className="modal-overlay open intake-save-confirm-overlay"
      onClick={(e) => {
        if (!saving && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box intake-save-confirm" role="dialog" aria-modal="true" aria-labelledby="intake-unsaved-nav-title">
        <div className="modal-header">
          <span id="intake-unsaved-nav-title" className="modal-title">
            {t("intake.unsavedNav.title")}
          </span>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label={t("intake.unsavedNav.cancel")}
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p className="intake-save-confirm__intro">{t("intake.unsavedNav.message")}</p>
        </div>
        <div className="modal-footer intake-unsaved-nav__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {t("intake.unsavedNav.cancel")}
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={onDiscard} disabled={saving}>
            {t("intake.unsavedNav.discard")}
          </button>
          <button type="button" className="btn btn-green" onClick={onSave} disabled={saving}>
            {t("intake.unsavedNav.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
