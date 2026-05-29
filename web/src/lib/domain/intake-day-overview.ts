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

export type ShopSlipGroup = {
  suppCode: string;
  suppName: string;
  shopTotal: number;
  slips: Array<SlipDayRow & { slipNo: number }>;
};

/** Oldest slip first (ใบที่ 1, 2, … left to right). */
export function sortSlipsOldestFirst<T extends { createdAt: string }>(slips: T[]): T[] {
  return [...slips].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Latest activity on a slip (edit time if edited, else created). */
export function slipLastActivityAt(slip: { createdAt: string; updatedAt?: string }): string {
  if (slip.updatedAt && slip.updatedAt !== slip.createdAt) return slip.updatedAt;
  return slip.createdAt;
}

/** Newest activity first (for day overview table). */
export function sortSlipsNewestFirst<T extends { createdAt: string; updatedAt?: string }>(
  slips: T[]
): T[] {
  return [...slips].sort((a, b) => slipLastActivityAt(b).localeCompare(slipLastActivityAt(a)));
}

/** Group day slips by shop; overview lists newest slips and shops first. */
export function groupSlipsByShop(slips: SlipDayRow[]): ShopSlipGroup[] {
  const byShop = new Map<string, SlipDayRow[]>();
  for (const s of slips) {
    const list = byShop.get(s.suppCode) ?? [];
    list.push(s);
    byShop.set(s.suppCode, list);
  }

  const groups: ShopSlipGroup[] = [];
  for (const shopSlips of byShop.values()) {
    const oldestFirst = sortSlipsOldestFirst(shopSlips);
    const slipNoById = new Map(oldestFirst.map((row, idx) => [row.id, idx + 1]));
    const displaySlips = sortSlipsNewestFirst(shopSlips).map((row) => ({
      ...row,
      slipNo: slipNoById.get(row.id) ?? 1,
    }));
    groups.push({
      suppCode: shopSlips[0]!.suppCode,
      suppName: shopSlips[0]!.suppName,
      shopTotal: shopSlips.reduce((sum, r) => sum + r.totalPrice, 0),
      slips: displaySlips,
    });
  }

  return groups.sort(
    (a, b) =>
      slipLastActivityAt(b.slips[0]!).localeCompare(slipLastActivityAt(a.slips[0]!))
  );
}

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

  // แสดงทุกใบในวันนั้น รวมร้านที่ปิดใช้งานแล้ว (มิฉะนั้นข้อมูลที่บันทึกไว้จะหายจากสรุปวัน)
  const enriched: SlipDayRow[] = slips.map((s) => ({
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
    const latest = sortSlipsNewestFirst(shopSlips)[0];
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
