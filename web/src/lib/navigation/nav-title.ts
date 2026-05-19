import type { MessageKey } from "@/lib/i18n/messages";
import { RECEIVING_PATH } from "@/lib/auth/paths";
import type { AppRole } from "@/lib/types";
import {
  adminCatalogNavItemsForRole,
  adminUsersNavItemForRole,
} from "@/lib/navigation/admin-nav";

const MAIN_ROUTES: { prefix: string; labelKey: MessageKey }[] = [
  { prefix: RECEIVING_PATH, labelKey: "nav.intake" },
  { prefix: "/history", labelKey: "nav.history" },
  { prefix: "/report", labelKey: "nav.report" },
  { prefix: "/profile", labelKey: "nav.profile" },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Label for the current page (drawer nav center title). */
export function getCurrentNavTitleKey(pathname: string, role: AppRole): MessageKey {
  if (pathname === "/" || pathname === "/intake" || matchesPrefix(pathname, RECEIVING_PATH)) {
    return "nav.intake";
  }

  for (const route of MAIN_ROUTES) {
    if (matchesPrefix(pathname, route.prefix)) {
      return route.labelKey;
    }
  }

  if (pathname.startsWith("/admin")) {
    for (const item of adminCatalogNavItemsForRole(role)) {
      if (matchesPrefix(pathname, item.href)) {
        return item.labelKey;
      }
    }
    const usersItem = adminUsersNavItemForRole(role);
    if (usersItem && matchesPrefix(pathname, usersItem.href)) {
      return usersItem.labelKey;
    }
    return "nav.settings";
  }

  return "nav.menu";
}
