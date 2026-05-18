import type { Item, Mapping } from "@/lib/types";

/** Filter catalog items by shop mapping; empty shopCode = all items. */
export function filterItemsByShop(items: Item[], mapping: Mapping[], shopCode: string): Item[] {
  const code = shopCode.trim();
  if (!code) return items;
  const linked = new Set(
    mapping.filter((m) => m.suppCode === code).map((m) => m.itemCode)
  );
  return items.filter((i) => linked.has(i.code));
}
