"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppRole } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n/messages";
import { apiPost } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useDrawerNav } from "@/hooks/useDrawerNav";
import { getCurrentNavTitleKey } from "@/lib/navigation/nav-title";
import { AppMobileMenu } from "@/components/nav/AppMobileMenu";
import { NavSettingsMenu } from "@/components/nav/NavSettingsMenu";
import { NavUserMenu } from "@/components/nav/NavUserMenu";
import { useAdminUnsavedOptional } from "@/components/admin/AdminUnsavedChangesProvider";
import { useIntakeNavGuardOptional } from "@/context/IntakeNavGuardContext";

const TABS: { href: string; labelKey: MessageKey; roles: AppRole[] }[] = [
  { href: "/receiving", labelKey: "nav.intake", roles: ["operator", "admin", "manager"] },
  { href: "/history", labelKey: "nav.history", roles: ["operator", "admin", "manager"] },
  { href: "/report", labelKey: "nav.report", roles: ["manager", "admin"] },
];

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
    if (href === "/receiving" || href === "/history" || href === "/report") {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname === href;
  }

  const adminUnsaved = useAdminUnsavedOptional();
  const intakeGuard = useIntakeNavGuardOptional();

  const refreshPage = useCallback(() => {
    window.location.reload();
  }, []);

  const onLogoClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (adminUnsaved?.dirty) {
        adminUnsaved.guardAction(refreshPage);
        return;
      }
      if (intakeGuard?.intakeDirty) {
        if (!window.confirm(t("intake.logoRefreshUnsavedConfirm"))) return;
        refreshPage();
        return;
      }
      refreshPage();
    },
    [adminUnsaved, intakeGuard, refreshPage, t]
  );

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
            subtitle={t("brand.subtitle")}
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
            >
              {t(tab.labelKey)}
            </Link>
          ))}
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
  subtitle,
  pageTitle,
  compact,
  drawerNav,
  onLogoClick,
}: {
  subtitle: string;
  pageTitle: string;
  compact?: boolean;
  drawerNav: boolean;
  onLogoClick: (e: React.MouseEvent) => void;
}) {
  const ariaLabel = drawerNav ? pageTitle : `Amazing Nongkhai — ${subtitle}`;

  return (
    <button
      type="button"
      className={`nav-brand${compact ? " nav-brand--compact" : ""}${drawerNav ? " nav-brand--drawer" : ""}`}
      aria-label={ariaLabel}
      title={drawerNav ? pageTitle : undefined}
      onClick={onLogoClick}
    >
      <Image
        src="/amazing-nkh-logo.png"
        alt=""
        width={54}
        height={38}
        className="nav-brand__logo"
        priority
      />
      {!drawerNav ? (
        <div className="nav-brand__text">
          <div className="brand-text brand-text--desktop-title">
            <span className="brand-name">Amazing Nongkhai</span>
            <span className="brand-sep" aria-hidden>
              {" "}
              |{" "}
            </span>
            <span className="brand-tagline">{subtitle}</span>
          </div>
        </div>
      ) : null}
    </button>
  );
}
