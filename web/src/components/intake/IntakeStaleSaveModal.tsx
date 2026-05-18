"use client";

import { IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";
import { formatAppDateTime } from "@/lib/utils/format";

type Props = {
  open: boolean;
  saving: boolean;
  serverSavedAt: string;
  serverSavedByName: string;
  onClose: () => void;
  onReload: () => void;
  onOverwrite: () => void;
};

export function IntakeStaleSaveModal({
  open,
  saving,
  serverSavedAt,
  serverSavedByName,
  onClose,
  onReload,
  onOverwrite,
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
      <div className="modal-box intake-save-confirm" role="dialog" aria-modal="true" aria-labelledby="intake-stale-save-title">
        <div className="modal-header">
          <span id="intake-stale-save-title" className="modal-title">
            {t("intake.staleSave.title")}
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
          <p className="intake-save-confirm__intro">{t("intake.staleSave.message")}</p>
          <p className="intake-save-confirm__warn">
            {t("intake.staleSave.serverMeta", {
              when: formatAppDateTime(serverSavedAt, locale),
              by: serverSavedByName || "—",
            })}
          </p>
        </div>
        <div className="modal-footer intake-unsaved-nav__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {t("intake.staleSave.cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onReload} disabled={saving}>
            {t("intake.staleSave.reload")}
          </button>
          <button type="button" className="btn btn-danger-outline" onClick={onOverwrite} disabled={saving}>
            {t("intake.staleSave.overwrite")}
          </button>
        </div>
      </div>
    </div>
  );
}
