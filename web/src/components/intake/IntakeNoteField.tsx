"use client";

import { useEffect, useState } from "react";
import { IconNote, IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  note: string;
  onChange: (value: string) => void;
  variant?: "card" | "table";
  /** ปุ่มไอคอนเล็ก (มือถือ) */
  iconTrigger?: boolean;
};

export function IntakeNoteField({ note, onChange, variant = "card", iconTrigger = false }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(() => !!note.trim());

  useEffect(() => {
    if (note.trim()) setOpen(true);
  }, [note]);

  function closeNote() {
    if (!note.trim()) setOpen(false);
    else {
      onChange("");
      setOpen(false);
    }
  }

  if (!open) {
    if (iconTrigger) {
      return (
        <button
          type="button"
          className="intake-note-icon-btn"
          onClick={() => setOpen(true)}
          aria-label={t("intake.addNote")}
          title={t("intake.addNote")}
        >
          <IconNote size={16} />
        </button>
      );
    }
    return (
      <button
        type="button"
        className={`intake-note-add ${variant === "table" ? "intake-note-add--table" : ""}`}
        onClick={() => setOpen(true)}
      >
        {t("intake.addNote")}
      </button>
    );
  }

  if (iconTrigger) {
    return (
      <div className="intake-note-field intake-note-field--icon">
        <input
          type="text"
          className="inp-note intake-touch-input intake-note-field--icon-input"
          value={note}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("intake.notePlaceholder")}
          aria-label={t("intake.note")}
        />
        <button
          type="button"
          className="intake-note-icon-btn intake-note-icon-btn--active"
          onClick={closeNote}
          aria-label={note.trim() ? t("intake.clearNote") : t("intake.hideNote")}
          title={note.trim() ? t("intake.clearNote") : t("intake.hideNote")}
        >
          <IconX size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={`intake-note-field ${variant === "table" ? "intake-note-field--table" : ""}`}>
      {variant === "card" ? <label className="lbl">{t("intake.note")}</label> : null}
      <div className="intake-note-field__row">
        <input
          type="text"
          className={`inp-note intake-touch-input ${variant === "table" ? "inp-note--table" : ""}`}
          value={note}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("intake.notePlaceholder")}
        />
        <button type="button" className="intake-note-collapse" onClick={closeNote}>
          {note.trim() ? t("intake.clearNote") : t("intake.hideNote")}
        </button>
      </div>
    </div>
  );
}
