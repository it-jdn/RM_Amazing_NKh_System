"use client";

import { usePathname } from "next/navigation";
import { IconClipboardList, IconInbox } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useGuardedNavigation } from "@/hooks/useGuardedNavigation";

const TABS = [
  { href: "/receiving", labelKey: "nav.intake" as const, Icon: IconInbox },
  { href: "/history", labelKey: "nav.history" as const, Icon: IconClipboardList },
];

export function OperatorBottomNav() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { navigate } = useGuardedNavigation();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="operator-bottom-nav" aria-label={t("nav.menu")}>
      {TABS.map(({ href, labelKey, Icon }) => {
        const active = isActive(href);
        return (
          <button
            key={href}
            type="button"
            className={`operator-bottom-nav__tab${active ? " operator-bottom-nav__tab--active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (!active) navigate(href);
            }}
          >
            <Icon size={22} aria-hidden />
            <span className="operator-bottom-nav__label">{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
