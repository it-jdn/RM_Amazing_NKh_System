"use client";

import { useEffect, useRef, useState } from "react";
import { useModalLayer } from "@/hooks/useModalLayer";
import { IconNote, IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** ปุ่มหมายเหตุทั้งใบ + Modal (ประหยัดพื้นที่) */
export function IntakeSlipNoteBar({ value, onChange }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useModalLayer({
    open,
    onClose: () => setOpen(false),
    initialFocusRef: textareaRef,
  });

  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);

  const hasNote = !!value.trim();

  function save() {
    onChange(draft.trim());
    setOpen(false);
  }

  function clear() {
    onChange("");
    setDraft("");
    setOpen(false);
  }

  return (
    <>
      <div className="intake-slip-note-bar">
        <button
          type="button"
          className={`intake-slip-note-bar__btn${hasNote ? " intake-slip-note-bar__btn--on" : ""}`}
          onClick={() => setOpen(true)}
          aria-label={t("intake.slipNoteBtn")}
          title={hasNote ? value.trim() : t("intake.slipNoteBtn")}
        >
          <IconNote size={20} />
          {hasNote ? <span className="intake-slip-note-bar__dot" aria-hidden /> : null}
        </button>
        {hasNote ? (
          <p className="intake-slip-note-bar__preview">{value.trim()}</p>
        ) : (
          <span className="intake-slip-note-bar__hint">{t("intake.slipNoteBtnHint")}</span>
        )}
      </div>

      {open ? (
        <div
          className="modal-overlay open"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal-box intake-slip-note-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <span className="modal-title">{t("intake.slipNoteModalTitle")}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label={t("intake.cancel")}
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <textarea
                ref={textareaRef}
                className="intake-slip-note-modal__input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("intake.slipNotePlaceholder")}
                rows={4}
                maxLength={500}
              />
            </div>
            <div className="modal-footer">
              {value.trim() ? (
                <button type="button" className="btn btn-ghost" onClick={clear}>
                  {t("intake.clearNote")}
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                {t("intake.cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                {t("intake.slipNoteSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
