import { sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { Locale } from "@/lib/i18n/types";
import type { Mapping, Supplier } from "@/lib/types";

/** itemCode → distinct shop (supplier) codes from mapping rows */
export function buildItemShopCodesMap(mapping: Mapping[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of mapping) {
    const list = map.get(m.itemCode) ?? [];
    if (!list.includes(m.suppCode)) list.push(m.suppCode);
    map.set(m.itemCode, list);
  }
  return map;
}

export function itemLinkedShopNames(
  itemCode: string,
  shopCodesByItem: Map<string, string[]>,
  suppliers: Supplier[],
  locale: Locale
): string[] {
  const codes = shopCodesByItem.get(itemCode) ?? [];
  if (!codes.length) return [];
  const byCode = new Map(suppliers.map((s) => [s.code, s]));
  const shops = codes.map((c) => byCode.get(c)).filter((s): s is Supplier => Boolean(s));
  return sortSuppliersForPicker(shops).map((s) => supplierDisplayName(s, locale));
}
