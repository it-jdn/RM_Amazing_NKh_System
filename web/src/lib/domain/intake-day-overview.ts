import { sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import type { IntakeSlipSummary, Item, ItemPurchaseUnit, Mapping, Supplier } from "@/lib/types";

export type ShopDayRow = {
  suppCode: string;
  suppName: string;
  lineCount: number;
  productCount: number;
  totalPrice: number;
  savedByName?: string;
  catalogItemCount: number;
};

export type SlipDayRow = IntakeSlipSummary & {
  catalogItemCount: number;
};

export type IntakeDayOverviewData = {
  slips: SlipDayRow[];
  dayTotal: number;
  slipCount: number;
  totalShopCount: number;
  /** @deprecated use slips — shops with at least one slip */
  saved: ShopDayRow[];
  savedShopCount: number;
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

export function buildDayOverviewFromSlips(
  slips: IntakeSlipSummary[],
  activeSuppliers: Supplier[],
  items: Item[],
  mapping: Mapping[],
  purchaseUnits: ItemPurchaseUnit[]
): IntakeDayOverviewData {
  const sorted = sortSuppliersForPicker(activeSuppliers);
  const activeCodes = new Set(sorted.map((s) => s.code));

  const enriched: SlipDayRow[] = slips
    .filter((s) => activeCodes.has(s.suppCode))
    .map((s) => ({
      ...s,
      catalogItemCount: catalogItemCountForShop(s.suppCode, items, mapping, purchaseUnits),
    }));

  const dayTotal = enriched.reduce((sum, s) => sum + s.totalPrice, 0);
  const shopsWithSlips = new Set(enriched.map((s) => s.suppCode));

  const saved: ShopDayRow[] = [];
  for (const supp of sorted) {
    if (!shopsWithSlips.has(supp.code)) continue;
    const shopSlips = enriched.filter((s) => s.suppCode === supp.code);
    const lineCount = shopSlips.reduce((n, s) => n + s.lineCount, 0);
    const productCount = shopSlips.reduce((n, s) => n + s.productCount, 0);
    const totalPrice = shopSlips.reduce((n, s) => n + s.totalPrice, 0);
    const latest = shopSlips[0];
    saved.push({
      suppCode: supp.code,
      suppName: latest?.suppName || supp.nameTH,
      lineCount,
      productCount,
      totalPrice,
      savedByName: latest?.createdByName,
      catalogItemCount: catalogItemCountForShop(supp.code, items, mapping, purchaseUnits),
    });
  }

  return {
    slips: enriched,
    dayTotal,
    slipCount: enriched.length,
    totalShopCount: sorted.length,
    saved,
    savedShopCount: saved.length,
  };
}

/** @deprecated kept for tests — aggregate by shop merges slips */
export function aggregateDayByShop(
  rows: import("@/lib/types").TransactionRow[],
  activeSuppliers: Supplier[],
  items: Item[],
  mapping: Mapping[],
  purchaseUnits: ItemPurchaseUnit[]
): IntakeDayOverviewData {
  return buildDayOverviewFromSlips([], activeSuppliers, items, mapping, purchaseUnits);
}
