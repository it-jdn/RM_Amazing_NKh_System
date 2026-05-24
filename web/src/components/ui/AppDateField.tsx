"use client";

import { useRef } from "react";
import { useLocale } from "@/context/LocaleContext";
import { IconCalendar } from "@/components/icons/AppIcons";
import { formatAppDate } from "@/lib/utils/format";

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input || input.disabled) return;
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      /* showPicker can throw if not user-gesture or unsupported */
    }
  }
  input.click();
}

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
};

/** Date picker with locale-formatted label (e.g. 17 พ.ค. 69) */
export function AppDateField({
  id,
  value,
  onChange,
  placeholder,
  className,
  "aria-label": ariaLabel,
  disabled,
}: Props) {
  const { locale } = useLocale();
  const nativeRef = useRef<HTMLInputElement>(null);
  const label = value ? formatAppDate(value, locale) : placeholder ?? "";

  return (
    <div
      role="group"
      className={`app-date-field${className ? ` ${className}` : ""}${value ? " app-date-field--filled" : ""}${disabled ? " app-date-field--disabled" : ""}`}
      onClick={() => {
        if (!disabled) openNativeDatePicker(nativeRef.current);
      }}
    >
      <div className="app-date-field__btn" aria-hidden="true">
        <span className="app-date-field__label">{label}</span>
        <IconCalendar className="app-date-field__icon" size={18} />
      </div>
      <input
        ref={nativeRef}
        id={id}
        type="date"
        className="app-date-field__native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder ?? "Date"}
      />
    </div>
  );
}
