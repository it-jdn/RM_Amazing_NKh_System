"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppRole } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { apiPost } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useDrawerNav } from "@/hooks/useDrawerNav";
import { getCurrentNavTitleKey } from "@/lib/navigation/nav-title";
import { AppMobileMenu } from "@/components/nav/AppMobileMenu";
import { NavReportsMenu } from "@/components/nav/NavReportsMenu";
import { NavSettingsMenu } from "@/components/nav/NavSettingsMenu";
import { NavUserMenu } from "@/components/nav/NavUserMenu";
import { useGuardedNavigation } from "@/hooks/useGuardedNavigation";

const TABS: { href: string; labelKey: MessageKey; roles: AppRole[] }[] = [
  { href: "/receiving", labelKey: "nav.intake", roles: ["operator", "admin", "manager"] },
  { href: "/history", labelKey: "nav.history", roles: ["operator", "admin", "manager"] },
];

const REPORT_MENU_ROLES: AppRole[] = ["manager", "admin"];

const SETTINGS_ROLES: AppRole[] = ["admin", "manager"];

export function AppNav({
  displayName,
  role,
}: {
  displayName?: string;
  role: AppRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const isOperator = role === "operator";
  const drawerNav = useDrawerNav();
  const pageTitle = t(getCurrentNavTitleKey(pathname, role));
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(role));
  const showSettings = SETTINGS_ROLES.includes(role);

  function tabActive(href: string) {
    if (href === "/receiving" || href === "/history") {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname === href;
  }

  const { navigate, goToReceiving } = useGuardedNavigation();

  function onLogoClick(e: React.MouseEvent) {
    e.preventDefault();
    goToReceiving();
  }

  function onTabClick(e: React.MouseEvent, href: string) {
    if (tabActive(href)) return;
    e.preventDefault();
    navigate(href);
  }

  async function logout() {
    await apiPost("/api/auth/logout", {});
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <nav className={`nav nav--drawer${isOperator ? " nav--operator" : ""}`}>
        <div className="nav-left">
          <AppMobileMenu role={role} displayName={displayName} onLogout={logout} />
          <NavBrand
            fullTitle={t("brand.fullTitle")}
            mobileTitle={t("brand.mobileTitle")}
            pageTitle={pageTitle}
            compact={isOperator}
            drawerNav={drawerNav}
            onLogoClick={onLogoClick}
          />
        </div>
        {drawerNav ? (
          <div className="nav-center">
            <p className="nav-center__title">{pageTitle}</p>
          </div>
        ) : null}
        <div className="nav-tabs">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`nav-tab ${tabActive(tab.href) ? "active" : ""}`}
              onClick={(e) => onTabClick(e, tab.href)}
            >
              {t(tab.labelKey)}
            </Link>
          ))}
          {REPORT_MENU_ROLES.includes(role) ? <NavReportsMenu role={role} /> : null}
          {showSettings ? <NavSettingsMenu role={role} /> : null}
        </div>
        <div className="nav-user">
          <div className="nav-user__cluster">
            {!drawerNav ? <LocaleSwitcher /> : null}
            <NavUserMenu displayName={displayName} role={role} onLogout={logout} />
          </div>
        </div>
      </nav>
      <div className="nav-accent" />
    </>
  );
}

function NavBrand({
  fullTitle,
  mobileTitle,
  pageTitle,
  compact,
  drawerNav,
  onLogoClick,
}: {
  fullTitle: string;
  mobileTitle: string;
  pageTitle: string;
  compact?: boolean;
  drawerNav: boolean;
  onLogoClick: (e: React.MouseEvent) => void;
}) {
  const ariaLabel = drawerNav ? `${mobileTitle} — ${pageTitle}` : fullTitle;

  return (
    <button
      type="button"
      className={`nav-brand${compact ? " nav-brand--compact" : ""}${drawerNav ? " nav-brand--drawer" : ""}`}
      aria-label={ariaLabel}
      title={drawerNav ? mobileTitle : fullTitle}
      onClick={onLogoClick}
    >
      <Image
        src="/amazing-nkh-logo-nav.png"
        alt=""
        width={1024}
        height={724}
        className="nav-brand__logo"
        priority
      />
      <div className="nav-brand__text">
        {drawerNav ? (
          <span className="brand-text brand-text--mobile-title">{mobileTitle}</span>
        ) : (
          <span className="brand-text brand-text--desktop-title">{fullTitle}</span>
        )}
      </div>
    </button>
  );
}
