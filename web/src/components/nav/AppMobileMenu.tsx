"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import type { MessageKey } from "@/lib/i18n/messages";
import { useLocale } from "@/context/LocaleContext";
import {
  IconChartBar,
  IconClipboardList,
  IconInbox,
  IconUser,
  IconX,
} from "@/components/icons/AppIcons";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useAdminUnsavedOptional } from "@/components/admin/AdminUnsavedChangesProvider";
import {
  adminCatalogNavItemsForRole,
  adminUsersNavItemForRole,
  type AdminNavItem,
} from "@/lib/navigation/admin-nav";
import type { AppRole } from "@/lib/types";

type MenuIcon = ComponentType<{ size?: number; className?: string }>;

const MAIN_LINKS: { href: string; labelKey: MessageKey; Icon: MenuIcon; roles: AppRole[] }[] = [
  { href: "/intake", labelKey: "nav.intake", Icon: IconInbox, roles: ["operator", "admin", "manager"] },
  { href: "/history", labelKey: "nav.history", Icon: IconClipboardList, roles: ["operator", "admin", "manager"] },
  { href: "/report", labelKey: "nav.report", Icon: IconChartBar, roles: ["manager", "admin"] },
  { href: "/profile", labelKey: "nav.profile", Icon: IconUser, roles: ["operator", "admin", "manager"] },
];

const SETTINGS_ROLES: AppRole[] = ["admin", "manager"];

function pathActive(pathname: string, href: string) {
  if (href === "/intake" || href === "/history" || href === "/report") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href;
}

function settingsItemActive(pathname: string, item: AdminNavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type Props = {
  role: AppRole;
  displayName?: string;
  onLogout: () => void | Promise<void>;
};

export function AppMobileMenu({ role, displayName, onLogout }: Props) {
  const pathname = usePathname();
  const { t } = useLocale();
  const unsaved = useAdminUnsavedOptional();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  const mainLinks = MAIN_LINKS.filter((link) => link.roles.includes(role));
  const showSettings = SETTINGS_ROLES.includes(role);
  const catalogItems = showSettings ? adminCatalogNavItemsForRole(role) : [];
  const usersItem = showSettings ? adminUsersNavItemForRole(role) : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setVisible(true);
    else setEntered(false);
  }, [open]);

  useEffect(() => {
    if (!visible || !open) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [visible, open]);

  useEffect(() => {
    if (open || !visible) return;
    const el = drawerRef.current;
    if (!el) {
      setVisible(false);
      return;
    }
    function onEnd(e: TransitionEvent) {
      if (e.target !== el || e.propertyName !== "transform") return;
      setVisible(false);
    }
    el.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(() => setVisible(false), 380);
    return () => {
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [open, visible]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  function close() {
    setOpen(false);
  }

  async function handleLogout() {
    close();
    await onLogout();
  }

  const panel =
    visible && mounted ? (
      <div className={`operator-menu-portal${entered ? " operator-menu-portal--open" : ""}`}>
        <button type="button" className="operator-menu__backdrop" aria-label={t("intake.cancel")} onClick={close} />
        <aside
          ref={drawerRef}
          className="operator-menu__drawer"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.menu")}
        >
          <header className="operator-menu__hdr">
            <Image
              src="/amazing-nkh-logo.png"
              alt=""
              width={48}
              height={34}
              className="operator-menu__logo"
            />
            <div className="operator-menu__brand">
              <span className="operator-menu__title">Amazing Nongkhai</span>
              <span className="operator-menu__subtitle">{t("brand.subtitle")}</span>
              {displayName ? <span className="operator-menu__user">{displayName}</span> : null}
            </div>
            <button type="button" className="operator-menu__close" onClick={close} aria-label={t("intake.cancel")}>
              <IconX size={18} />
            </button>
          </header>

          <nav className="operator-menu__nav">
            {mainLinks.map((link) => {
              const active = pathActive(pathname, link.href);
              const LinkIcon = link.Icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`operator-menu__link ${active ? "active" : ""}`}
                  onClick={close}
                >
                  <span className="operator-menu__link-icon" aria-hidden>
                    <LinkIcon size={20} />
                  </span>
                  <span>{t(link.labelKey)}</span>
                </Link>
              );
            })}
          </nav>

          {showSettings ? (
            <div className="operator-menu__section">
              <span className="operator-menu__section-lbl">{t("nav.settings")}</span>
              <div className="operator-menu__subnav">
                {catalogItems.map((item) => {
                  const active = settingsItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`operator-menu__sublink ${active ? "active" : ""}`}
                      onClick={(e) => {
                        if (!active && unsaved) {
                          e.preventDefault();
                          close();
                          unsaved.requestNavigation(item.href);
                          return;
                        }
                        close();
                      }}
                    >
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
                {usersItem ? (
                  <Link
                    href={usersItem.href}
                    className={`operator-menu__sublink operator-menu__sublink--users ${settingsItemActive(pathname, usersItem) ? "active" : ""}`}
                    onClick={(e) => {
                      const active = settingsItemActive(pathname, usersItem);
                      if (!active && unsaved) {
                        e.preventDefault();
                        close();
                        unsaved.requestNavigation(usersItem.href);
                        return;
                      }
                      close();
                    }}
                  >
                    {t(usersItem.labelKey)}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="operator-menu__locale">
            <span className="operator-menu__section-lbl">{t("lang.label")}</span>
            <LocaleSwitcher variant="menu" />
          </div>

          <footer className="operator-menu__footer">
            <button type="button" className="operator-menu__logout" onClick={handleLogout}>
              {t("nav.logout")}
            </button>
          </footer>
        </aside>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        className="nav-hamburger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("nav.menu")}
        onClick={() => setOpen(true)}
      >
        <span className="nav-hamburger__bar" aria-hidden />
        <span className="nav-hamburger__bar" aria-hidden />
        <span className="nav-hamburger__bar" aria-hidden />
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
