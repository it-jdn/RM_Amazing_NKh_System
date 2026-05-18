"use client";

import { useRef } from "react";
import { useLocale } from "@/context/LocaleContext";
import { IconCalendar } from "@/components/icons/AppIcons";
import { formatAppDate } from "@/lib/utils/format";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const label = value ? formatAppDate(value, locale) : placeholder ?? "";

  function openPicker() {
    if (disabled) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  }

  return (
    <div
      className={`app-date-field${className ? ` ${className}` : ""}${disabled ? " app-date-field--disabled" : ""}`}
    >
      <button
        type="button"
        className="app-date-field__btn"
        onClick={openPicker}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
      >
        <span className="app-date-field__label">{label}</span>
        <IconCalendar className="app-date-field__icon" size={17} />
      </button>
      <input
        ref={inputRef}
        id={id}
        type="date"
        className="app-date-field__native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
