"use client";

import { useLocale } from "@/context/LocaleContext";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/** หมายเหตุทั้งใบ (วันที่ + ร้าน) */
export function IntakeSlipNoteField({ value, onChange, className }: Props) {
  const { t } = useLocale();
  return (
    <div className={className ? `intake-slip-note ${className}` : "intake-slip-note"}>
      <label className="intake-slip-note__lbl" htmlFor="intake-slip-note">
        {t("intake.note")}
      </label>
      <textarea
        id="intake-slip-note"
        className="intake-slip-note__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("intake.slipNotePlaceholder")}
        rows={2}
        maxLength={500}
      />
    </div>
  );
}
