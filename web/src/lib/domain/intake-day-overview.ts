import { slipMetaFromRows } from "@/lib/domain/intake-slip";
import { sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import type { Item, ItemPurchaseUnit, Mapping, Supplier, TransactionRow } from "@/lib/types";

export type ShopDayRow = {
  suppCode: string;
  suppName: string;
  lineCount: number;
  productCount: number;
  totalPrice: number;
  savedByName?: string;
  catalogItemCount: number;
};

export type IntakeDayOverviewData = {
  saved: ShopDayRow[];
  pending: ShopDayRow[];
  dayTotal: number;
  savedShopCount: number;
  totalShopCount: number;
};

export function catalogItemCountForShop(
  suppCode: string,
  items: Item[],
  mapping: Mapping[],
  purchaseUnits: ItemPurchaseUnit[]
): number {
  const codes = new Set<string>();
  mapping.filter((m) => m.suppCode === suppCode).forEach((m) => codes.add(m.itemCode));
  purchaseUnits.filter((p) => p.suppCode === suppCode).forEach((p) => codes.add(p.itemCode));
  return items.filter((i) => codes.has(i.code)).length;
}

export function aggregateDayByShop(
  rows: TransactionRow[],
  activeSuppliers: Supplier[],
  items: Item[],
  mapping: Mapping[],
  purchaseUnits: ItemPurchaseUnit[]
): IntakeDayOverviewData {
  const sorted = sortSuppliersForPicker(activeSuppliers);
  const activeCodes = new Set(sorted.map((s) => s.code));
  const byShop = new Map<string, TransactionRow[]>();

  for (const row of rows) {
    if (!activeCodes.has(row.suppCode)) continue;
    const list = byShop.get(row.suppCode) ?? [];
    list.push(row);
    byShop.set(row.suppCode, list);
  }

  let dayTotal = 0;
  const saved: ShopDayRow[] = [];

  for (const supp of sorted) {
    const shopRows = byShop.get(supp.code);
    if (!shopRows?.length) continue;

    const meta = slipMetaFromRows(shopRows);
    const totalPrice = shopRows.reduce(
      (sum, r) => sum + (parseFloat(String(r.totalPrice)) || 0),
      0
    );
    dayTotal += totalPrice;

    const nameFromRow = shopRows.find((r) => r.suppName?.trim())?.suppName;
    saved.push({
      suppCode: supp.code,
      suppName: nameFromRow?.trim() || supp.nameTH || supp.code,
      lineCount: meta.rowCount,
      productCount: meta.productCount,
      totalPrice,
      savedByName: meta.savedByName || undefined,
      catalogItemCount: catalogItemCountForShop(supp.code, items, mapping, purchaseUnits),
    });
  }

  return {
    saved,
    pending: [],
    dayTotal,
    savedShopCount: saved.length,
    totalShopCount: sorted.length,
  };
}
