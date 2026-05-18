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
import { AppMobileMenu } from "@/components/nav/AppMobileMenu";
import { NavSettingsMenu } from "@/components/nav/NavSettingsMenu";
import { NavUserMenu } from "@/components/nav/NavUserMenu";

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
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(role));
  const showSettings = SETTINGS_ROLES.includes(role);

  function tabActive(href: string) {
    if (href === "/receiving" || href === "/history" || href === "/report") {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname === href;
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
            subtitle={t("brand.subtitle")}
            compact={isOperator}
            drawerNav={drawerNav}
          />
        </div>
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
  compact,
  drawerNav,
}: {
  subtitle: string;
  compact?: boolean;
  drawerNav: boolean;
}) {
  const ariaLabel = drawerNav ? subtitle : `Amazing Nongkhai — ${subtitle}`;

  return (
    <Link
      href="/"
      className={`nav-brand${compact ? " nav-brand--compact" : ""}`}
      aria-label={ariaLabel}
    >
      <Image
        src="/amazing-nkh-logo.png"
        alt=""
        width={54}
        height={38}
        className="nav-brand__logo"
        priority
      />
      <div className="nav-brand__text">
        {drawerNav ? (
          <div className="brand-text brand-text--mobile-title">{subtitle}</div>
        ) : (
          <div className="brand-text brand-text--desktop-title">
            <span className="brand-name">Amazing Nongkhai</span>
            <span className="brand-sep" aria-hidden>
              {" "}
              |{" "}
            </span>
            <span className="brand-tagline">{subtitle}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
