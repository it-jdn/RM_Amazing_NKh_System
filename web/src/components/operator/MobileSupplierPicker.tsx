"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";
import { IconChevronDown, IconX } from "@/components/icons/AppIcons";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { Supplier } from "@/lib/types";

type Props = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  suppliers: Supplier[];
  placeholder: string;
};

/** ร้านค้าบนมือถือ — ไม่ใช้ native select (iOS แสดงผิดเพี้ยน) */
export function MobileSupplierPicker({
  id = "intake-supp-m",
  value,
  onChange,
  suppliers,
  placeholder,
}: Props) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = suppliers.find((s) => s.code === value);
  const label = selected ? supplierDisplayName(selected, locale) : placeholder;

  useEffect(() => setMounted(true), []);

  useModalLayer({ open, onClose: () => setOpen(false) });

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const sheet =
    open && mounted ? (
      <div className="supplier-picker-portal">
        <button
          type="button"
          className="supplier-picker__backdrop"
          aria-label={t("intake.cancel")}
          onClick={() => setOpen(false)}
        />
        <div className="supplier-picker__sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
          <div className="supplier-picker__handle" aria-hidden />
          <div className="supplier-picker__header">
            <h2 id={`${id}-title`} className="supplier-picker__title">
              {t("intake.supplier")}
            </h2>
            <button type="button" className="supplier-picker__close" onClick={() => setOpen(false)} aria-label={t("intake.cancel")}>
              <IconX size={18} />
            </button>
          </div>
          <ul className="supplier-picker__list" role="listbox" aria-label={t("intake.supplier")}>
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={`supplier-picker__option ${!value ? "active" : ""}`}
                onClick={() => pick("")}
              >
                {placeholder}
              </button>
            </li>
            {suppliers.map((s) => (
              <li key={s.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === s.code}
                  className={`supplier-picker__option ${value === s.code ? "active" : ""}`}
                  onClick={() => pick(s.code)}
                >
                  <span className="supplier-picker__option-name">{supplierDisplayName(s, locale)}</span>
                  {value === s.code ? (
                    <span className="supplier-picker__check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`supplier-picker__trigger intake-mobile-setup__input ${value ? "supplier-picker__trigger--filled" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="supplier-picker__value">{label}</span>
        <IconChevronDown className="supplier-picker__chev" size={16} />
      </button>
      {mounted && sheet ? createPortal(sheet, document.body) : null}
    </>
  );
}
