import type { MessageKey } from "@/lib/i18n/messages";
import type { AppRole } from "@/lib/types";

export type AdminNavItem = {
  href: string;
  labelKey: MessageKey;
  adminOnly?: boolean;
};

/** ลำดับตั้งค่าหลัก: ร้านค้า → หน่วยสินค้า → สินค้า → ผูกสินค้ากับร้านค้า */
export const ADMIN_CATALOG_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/shops", labelKey: "nav.settings.shops" },
  { href: "/admin/units", labelKey: "nav.settings.units", adminOnly: true },
  { href: "/admin/items", labelKey: "nav.settings.items" },
  { href: "/admin/products", labelKey: "nav.settings.products" },
];

export const ADMIN_USERS_NAV_ITEM: AdminNavItem = {
  href: "/admin/users",
  labelKey: "nav.settings.users",
  adminOnly: true,
};

export function adminCatalogNavItemsForRole(role: AppRole): AdminNavItem[] {
  return ADMIN_CATALOG_NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
}

export function adminUsersNavItemForRole(role: AppRole): AdminNavItem | null {
  if (role !== "admin") return null;
  return ADMIN_USERS_NAV_ITEM;
}

/** @deprecated ใช้ adminCatalogNavItemsForRole */
export function adminNavItemsForRole(role: AppRole): AdminNavItem[] {
  return adminCatalogNavItemsForRole(role);
}

export function isAdminCatalogPath(pathname: string): boolean {
  return ADMIN_CATALOG_NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}

export function isAdminUsersPath(pathname: string): boolean {
  return pathname === ADMIN_USERS_NAV_ITEM.href || pathname.startsWith(`${ADMIN_USERS_NAV_ITEM.href}/`);
}

export function isAdminSettingsPath(pathname: string): boolean {
  return isAdminCatalogPath(pathname) || isAdminUsersPath(pathname);
}
