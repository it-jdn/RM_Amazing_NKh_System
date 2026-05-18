"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconGlobe } from "@/components/icons/AppIcons";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { useLocale } from "@/context/LocaleContext";
import { useDropdownTransition } from "@/hooks/useDropdownTransition";

const SHORT: Record<Locale, string> = {
  th: "TH",
  en: "EN",
  kr: "KR",
};

export function LocaleSwitcher({
  variant = "nav",
}: {
  variant?: "nav" | "login" | "loginCorner" | "menu";
}) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { visible, entered, panelRef } = useDropdownTransition(open);

  useEffect(() => {
    if (!visible) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  function pick(id: Locale) {
    setLocale(id);
    setOpen(false);
  }

  if (variant === "menu") {
    return (
      <div className="lang-switch lang-switch--menu" role="listbox" aria-label={t("lang.label")}>
        {LOCALES.map((l) => (
          <button
            key={l.id}
            type="button"
            role="option"
            aria-selected={locale === l.id}
            className={`lang-switch__pill ${locale === l.id ? "active" : ""}`}
            onClick={() => setLocale(l.id)}
          >
            <span className="lang-switch__pill-code">{SHORT[l.id]}</span>
            <span className="lang-switch__pill-label">{l.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`lang-switch lang-switch--${variant}`} ref={rootRef}>
      <button
        type="button"
        className="lang-switch__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-label={`${t("lang.label")}: ${SHORT[locale]}`}
      >
        <IconGlobe className="lang-switch__globe" size={16} />
        <span className="lang-switch__code">{SHORT[locale]}</span>
        <span className="lang-switch__chev" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {visible ? (
        <ul
          ref={panelRef}
          id={menuId}
          className={`lang-switch__menu${entered ? " lang-switch__menu--open" : ""}`}
          role="listbox"
          aria-label={t("lang.label")}
        >
          {LOCALES.map((l) => (
            <li key={l.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={locale === l.id}
                className={`lang-switch__option ${locale === l.id ? "active" : ""}`}
                onClick={() => pick(l.id)}
              >
                <span className="lang-switch__option-code">{SHORT[l.id]}</span>
                <span className="lang-switch__option-label">{l.label}</span>
                {locale === l.id ? (
                  <span className="lang-switch__check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
