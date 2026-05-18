"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { adminCatalogNavItemsForRole } from "@/lib/navigation/admin-nav";
import type { AppRole } from "@/lib/types";
import { useAdminUnsavedOptional } from "@/components/admin/AdminUnsavedChangesProvider";

export function AdminSubNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const unsaved = useAdminUnsavedOptional();
  const items = adminCatalogNavItemsForRole(role);

  return (
    <nav
      className={`admin-subnav admin-subnav--${items.length}`}
      aria-label={t("nav.settings")}
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-subnav__link ${active ? "active" : ""}`}
            onClick={(e) => {
              if (!active && unsaved) {
                e.preventDefault();
                unsaved.requestNavigation(item.href);
              }
            }}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
