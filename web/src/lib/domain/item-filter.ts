import type { Item, Mapping } from "@/lib/types";

/** Select value: show items with no shop mapping rows. */
export const ITEM_FILTER_UNLINKED = "__unlinked__";

export type CatalogItemFilters = {
  shopCodes: string[];
  categoryCodes: string[];
};

/** Filter catalog items by shop mapping; empty shopCodes = no shop filter. */
export function filterItemsByShops(items: Item[], mapping: Mapping[], shopCodes: string[]): Item[] {
  const codes = shopCodes.map((c) => c.trim()).filter(Boolean);
  if (!codes.length) return items;

  const wantsUnlinked = codes.includes(ITEM_FILTER_UNLINKED);
  const shopOnly = codes.filter((c) => c !== ITEM_FILTER_UNLINKED);
  const allLinked = new Set(mapping.map((m) => m.itemCode));
  const linkedToSelected = new Set<string>();
  if (shopOnly.length) {
    const shopSet = new Set(shopOnly);
    for (const m of mapping) {
      if (shopSet.has(m.suppCode)) linkedToSelected.add(m.itemCode);
    }
  }

  return items.filter((i) => {
    if (wantsUnlinked && !allLinked.has(i.code)) return true;
    if (shopOnly.length && linkedToSelected.has(i.code)) return true;
    return false;
  });
}

/** Filter by category codes (any match); empty = no category filter. */
export function filterItemsByCategories(items: Item[], categoryCodes: string[]): Item[] {
  const codes = categoryCodes.map((c) => c.trim()).filter(Boolean);
  if (!codes.length) return items;
  const set = new Set(codes);
  return items.filter((i) => set.has(i.categoryCode));
}

/** Combined shop + category filters for admin catalog lists. */
export function filterCatalogItems(
  items: Item[],
  mapping: Mapping[],
  filters: CatalogItemFilters
): Item[] {
  let list = filterItemsByCategories(items, filters.categoryCodes);
  list = filterItemsByShops(list, mapping, filters.shopCodes);
  return list;
}

/** @deprecated Use filterItemsByShops / filterCatalogItems with shopCodes array. */
export function filterItemsByShop(items: Item[], mapping: Mapping[], shopCode: string): Item[] {
  const code = shopCode.trim();
  if (!code) return items;
  return filterItemsByShops(items, mapping, [code]);
}

export function emptyCatalogFilters(): CatalogItemFilters {
  return { shopCodes: [], categoryCodes: [] };
}

export function itemMatchesCatalogFilters(
  item: Item,
  mapping: Mapping[],
  filters: CatalogItemFilters
): boolean {
  return filterCatalogItems([item], mapping, filters).length > 0;
}
