"use client";

import { useLocale } from "@/context/LocaleContext";

type Props = {
  receivedCount: number;
  canEdit: boolean;
  dirty: boolean;
  saving: boolean;
  loadingMeta: boolean;
  onSave: () => void;
};

export function HistoryStickyFooter({
  receivedCount,
  canEdit,
  dirty,
  saving,
  loadingMeta,
  onSave,
}: Props) {
  const { t } = useLocale();

  return (
    <div className="hist-sticky-bar" role="region" aria-label={t("hist.saveChanges")}>
      <div className="hist-sticky-bar__main">
        <div className="hist-sticky-bar__info">
          <p className="hist-sticky-bar__count">
            {t("hist.receivedCount")}: <strong>{receivedCount}</strong>
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary hist-sticky-bar__save"
            disabled={saving || loadingMeta || !dirty}
            onClick={onSave}
          >
            {saving ? t("hist.saving") : t("hist.saveChanges")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
