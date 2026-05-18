import type { Item, Mapping } from "@/lib/types";

/** Select value: show items with no shop mapping rows. */
export const ITEM_FILTER_UNLINKED = "__unlinked__";

/** Filter catalog items by shop mapping; empty shopCode = all items. */
export function filterItemsByShop(items: Item[], mapping: Mapping[], shopCode: string): Item[] {
  const code = shopCode.trim();
  if (!code) return items;
  if (code === ITEM_FILTER_UNLINKED) {
    const linked = new Set(mapping.map((m) => m.itemCode));
    return items.filter((i) => !linked.has(i.code));
  }
  const linked = new Set(
    mapping.filter((m) => m.suppCode === code).map((m) => m.itemCode)
  );
  return items.filter((i) => linked.has(i.code));
}
