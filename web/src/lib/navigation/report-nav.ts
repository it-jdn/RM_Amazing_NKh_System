import type { MessageKey } from "@/lib/i18n/messages";
import type { AppRole } from "@/lib/types";

export type ReportNavItem = { href: string; labelKey: MessageKey };

const REPORT_ROLES: AppRole[] = ["manager", "admin"];

export const REPORT_NAV_ITEMS: ReportNavItem[] = [
  { href: "/report", labelKey: "nav.report.summary" },
  { href: "/report/item-price", labelKey: "nav.report.itemPrice" },
];

export function reportNavItemsForRole(role: AppRole): ReportNavItem[] {
  return REPORT_ROLES.includes(role) ? REPORT_NAV_ITEMS : [];
}

export function isReportPath(pathname: string): boolean {
  return REPORT_NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}
