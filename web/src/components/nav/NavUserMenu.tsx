"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconLogOut, IconUser } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useDrawerNav } from "@/hooks/useDrawerNav";
import { useDropdownTransition } from "@/hooks/useDropdownTransition";
import type { AppRole } from "@/lib/types";
import { userDisplayInitial } from "@/lib/users/display-name";

type MenuPos = { top: number; left: number; minWidth: number };

export function NavUserMenu({
  displayName,
  role,
  onLogout,
}: {
  displayName?: string;
  role: AppRole;
  onLogout: () => void | Promise<void>;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const drawerNav = useDrawerNav();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const { visible, entered, panelRef } = useDropdownTransition(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const name = displayName?.trim() || role;
  const profileActive = pathname === "/profile" || pathname.startsWith("/profile/");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!visible) return;
    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const minWidth = Math.max(260, rect.width);
      setMenuPos({
        top: rect.bottom + 8,
        left: Math.max(8, rect.right - minWidth),
        minWidth,
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

  function roleLabel() {
    if (role === "operator") return t("role.operator");
    if (role === "manager") return t("role.manager");
    return t("role.admin");
  }

  async function handleLogout() {
    setOpen(false);
    await onLogout();
  }

  const menuPanel =
    visible && menuPos && mounted ? (
      <ul
        ref={panelRef}
        id={menuId}
        className={`nav-user-menu__dropdown nav-settings__menu nav-settings__menu--portal${entered ? " nav-settings__menu--open" : ""}`}
        role="menu"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          minWidth: menuPos.minWidth,
        }}
      >
        <li className="nav-user-menu__identity" role="presentation">
          <span className="nav-user-menu__identity-name">{name}</span>
          <span className="nav-user-menu__identity-role">{roleLabel()}</span>
        </li>
        <li role="presentation" className="nav-user-menu__divider" />
        <li role="presentation">
          <Link
            href="/profile"
            role="menuitem"
            className={`nav-settings__option nav-user-menu__item ${profileActive ? "active" : ""}`}
            onClick={() => setOpen(false)}
          >
            <IconUser size={18} className="nav-user-menu__item-icon" />
            {t("nav.profile")}
          </Link>
        </li>
        <li role="presentation" className="nav-user-menu__divider" />
        <li role="presentation">
          <button
            type="button"
            role="menuitem"
            className="nav-user-menu__logout"
            onClick={handleLogout}
          >
            <IconLogOut size={18} className="nav-user-menu__item-icon" />
            {t("nav.logout")}
          </button>
        </li>
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="nav-user-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`nav-user-menu__trigger${drawerNav ? " nav-user-menu__trigger--compact" : ""} ${open || profileActive ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={drawerNav ? t("nav.profile") : undefined}
        title={drawerNav ? t("nav.profile") : undefined}
      >
        <span className="nav-user-menu__avatar" aria-hidden>
          {userDisplayInitial(displayName)}
        </span>
        {!drawerNav ? (
          <>
            <span className="nav-user-menu__label">{name}</span>
            <IconChevronDown size={14} className={`nav-settings__chev ${open ? "open" : ""}`} />
          </>
        ) : null}
      </button>
      {mounted && menuPanel ? createPortal(menuPanel, document.body) : null}
    </div>
  );
}
