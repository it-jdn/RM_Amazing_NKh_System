"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { isReportPath, reportNavItemsForRole } from "@/lib/navigation/report-nav";
import type { ReportNavItem } from "@/lib/navigation/report-nav";
import type { AppRole } from "@/lib/types";
import { useGuardedNavigation } from "@/hooks/useGuardedNavigation";
import { useDropdownTransition } from "@/hooks/useDropdownTransition";

type MenuPos = { top: number; left: number; minWidth: number };

function navItemActive(pathname: string, item: ReportNavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavReportsMenu({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const items = reportNavItemsForRole(role);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const { visible, entered, panelRef } = useDropdownTransition(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const reportActive = isReportPath(pathname);
  const { navigate } = useGuardedNavigation();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        minWidth: Math.max(200, rect.width),
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(target)) return;
      setOpen(false);
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
  }, [visible, menuId]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!items.length) return null;

  const menuPanel =
    visible && menuPos && mounted ? (
      <ul
        ref={panelRef}
        id={menuId}
        className={`nav-settings__menu nav-settings__menu--portal${entered ? " nav-settings__menu--open" : ""}`}
        role="menu"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          minWidth: menuPos.minWidth,
        }}
      >
        {items.map((item) => {
          const active = navItemActive(pathname, item);
          return (
            <li key={item.href} role="presentation">
              <Link
                href={item.href}
                role="menuitem"
                className={`nav-settings__option ${active ? "active" : ""}`}
                onClick={(e) => {
                  setOpen(false);
                  if (!active) {
                    e.preventDefault();
                    navigate(item.href);
                  }
                }}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="nav-settings">
      <button
        ref={triggerRef}
        type="button"
        className={`nav-tab nav-settings__trigger ${reportActive ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {t("nav.report")}
        <IconChevronDown size={14} className={`nav-settings__chev ${open ? "open" : ""}`} />
      </button>
      {mounted && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
