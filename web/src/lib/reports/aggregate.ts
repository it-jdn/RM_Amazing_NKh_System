import type { ItemCategory, ItemCategoryCode } from "@/lib/types";
import {
  DEFAULT_ITEM_CATEGORY,
  isItemCategoryCode,
} from "@/lib/catalog/item-categories";
import { toDateStr } from "@/lib/domain/transactions";

export type ReportTxnRow = {
  txn_date: string;
  supp_code: string;
  supp_name: string;
  item_code: string;
  item_name_th: string;
  qty: number | string;
  main_unit: string;
  total_price: number | string;
  unit_price?: number | string | null;
  standard_unit_price_at_save?: number | string | null;
  no?: number;
};

export type ReportSummary = {
  totalCost: number;
  totalTrans: number;
  avgDailyCost: number;
  daysWithActivity: number;
  distinctItems: number;
  distinctSuppliers: number;
  totalQty: number;
  avgPriceVariancePct: number | null;
};

export type ReportByDate = {
  date: string;
  totalPrice: number;
  totalQty: number;
  count: number;
};

export type ReportByItem = {
  itemCode: string;
  itemName: string;
  qty: number;
  totalPrice: number;
  count: number;
  sharePct: number;
};

export type ReportBySupp = {
  suppCode: string;
  suppName: string;
  totalPrice: number;
  count: number;
  sharePct: number;
};

export type ReportByCategory = {
  categoryCode: ItemCategoryCode;
  categoryNameTH: string;
  totalPrice: number;
  count: number;
  distinctItems: number;
  sharePct: number;
};

export type ReportPriceVarianceMonth = {
  month: string;
  avgVariancePct: number;
  sampleCount: number;
};

export type ReportHeatmapCell = {
  dayOfWeek: number;
  weekStart: string;
  totalPrice: number;
  count: number;
};

export type ReportAggregates = {
  summary: ReportSummary;
  byCategory: ReportByCategory[];
  byItem: ReportByItem[];
  byDate: ReportByDate[];
  bySupp: ReportBySupp[];
  cumulativeByDate: { date: string; cumulative: number }[];
  topItemsByValue: ReportByItem[];
  topItemsByQty: ReportByItem[];
  priceVarianceByMonth: ReportPriceVarianceMonth[];
  weeklyHeatmap: ReportHeatmapCell[];
};

function parseNum(v: unknown) {
  return parseFloat(String(v)) || 0;
}

function weekStartMonday(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function aggregateReportRows(
  rows: ReportTxnRow[],
  itemCategoryMap: Map<string, ItemCategoryCode>,
  categories: ItemCategory[]
): ReportAggregates {
  const categoryMeta = new Map(categories.map((c) => [c.code, c]));
  const totalCost = rows.reduce((s, t) => s + parseNum(t.total_price), 0);

  const itemCodes = new Set<string>();
  const suppCodes = new Set<string>();
  let totalQty = 0;
  const varianceSamples: number[] = [];

  const byItemMap: Record<
    string,
    { itemCode: string; itemName: string; qty: number; totalPrice: number; count: number }
  > = {};
  const byDateMap: Record<string, ReportByDate> = {};
  const bySuppMap: Record<
    string,
    { suppCode: string; suppName: string; totalPrice: number; count: number }
  > = {};
  const byCategoryMap: Record<
    string,
    {
      categoryCode: ItemCategoryCode;
      categoryNameTH: string;
      totalPrice: number;
      count: number;
      itemCount: Set<string>;
    }
  > = {};
  const monthVariance: Record<string, { sum: number; n: number }> = {};
  const heatmap: Record<string, ReportHeatmapCell> = {};

  for (const t of rows) {
    const price = parseNum(t.total_price);
    const qty = parseNum(t.qty);
    totalQty += qty;
    itemCodes.add(String(t.item_code));
    suppCodes.add(String(t.supp_code));

    const unitPrice = parseNum(t.unit_price);
    const std = t.standard_unit_price_at_save != null ? parseNum(t.standard_unit_price_at_save) : 0;
    if (std > 0 && unitPrice > 0) {
      varianceSamples.push(((unitPrice - std) / std) * 100);
    }

    const itemCode = String(t.item_code);
    if (!byItemMap[itemCode]) {
      byItemMap[itemCode] = {
        itemCode,
        itemName: String(t.item_name_th),
        qty: 0,
        totalPrice: 0,
        count: 0,
      };
    }
    byItemMap[itemCode].qty += qty;
    byItemMap[itemCode].totalPrice += price;
    byItemMap[itemCode].count++;

    const d = toDateStr(t.txn_date);
    if (!byDateMap[d]) byDateMap[d] = { date: d, totalPrice: 0, totalQty: 0, count: 0 };
    byDateMap[d].totalPrice += price;
    byDateMap[d].totalQty += qty;
    byDateMap[d].count++;

    const sc = String(t.supp_code);
    if (!bySuppMap[sc]) {
      bySuppMap[sc] = {
        suppCode: sc,
        suppName: String(t.supp_name || sc),
        totalPrice: 0,
        count: 0,
      };
    }
    bySuppMap[sc].totalPrice += price;
    bySuppMap[sc].count++;

    const cat = itemCategoryMap.get(itemCode) || DEFAULT_ITEM_CATEGORY;
    if (!byCategoryMap[cat]) {
      const meta = categoryMeta.get(cat);
      byCategoryMap[cat] = {
        categoryCode: cat,
        categoryNameTH: meta?.nameTH || cat,
        totalPrice: 0,
        count: 0,
        itemCount: new Set(),
      };
    }
    byCategoryMap[cat].totalPrice += price;
    byCategoryMap[cat].count++;
    byCategoryMap[cat].itemCount.add(itemCode);

    if (d) {
      const month = d.slice(0, 7);
      if (std > 0 && unitPrice > 0) {
        if (!monthVariance[month]) monthVariance[month] = { sum: 0, n: 0 };
        monthVariance[month].sum += ((unitPrice - std) / std) * 100;
        monthVariance[month].n++;
      }
      const dow = new Date(d + "T12:00:00").getDay();
      const ws = weekStartMonday(d);
      const hk = `${ws}|${dow}`;
      if (!heatmap[hk]) heatmap[hk] = { dayOfWeek: dow, weekStart: ws, totalPrice: 0, count: 0 };
      heatmap[hk].totalPrice += price;
      heatmap[hk].count++;
    }
  }

  const byDate = Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date));
  const daysWithActivity = byDate.length;
  const avgDailyCost = daysWithActivity > 0 ? totalCost / daysWithActivity : 0;

  const withShare = <T extends { totalPrice: number }>(list: T[]) =>
    list.map((row) => ({
      ...row,
      sharePct: totalCost > 0 ? (row.totalPrice / totalCost) * 100 : 0,
    }));

  const byItem = withShare(
    Object.values(byItemMap).sort((a, b) => b.totalPrice - a.totalPrice)
  ) as ReportByItem[];

  const bySupp = withShare(
    Object.values(bySuppMap).sort((a, b) => b.totalPrice - a.totalPrice)
  ) as ReportBySupp[];

  const byCategory = withShare(
    Object.values(byCategoryMap)
      .map((row) => ({
        categoryCode: row.categoryCode,
        categoryNameTH: row.categoryNameTH,
        totalPrice: row.totalPrice,
        count: row.count,
        distinctItems: row.itemCount.size,
        sharePct: 0,
      }))
      .sort((a, b) => b.totalPrice - a.totalPrice)
  ) as ReportByCategory[];

  let cumulative = 0;
  const cumulativeByDate = byDate.map((row) => {
    cumulative += row.totalPrice;
    return { date: row.date, cumulative };
  });

  const topItemsByValue = byItem.slice(0, 10);
  const topItemsByQty = [...byItem].sort((a, b) => b.qty - a.qty).slice(0, 10);

  const priceVarianceByMonth = Object.entries(monthVariance)
    .map(([month, v]) => ({
      month,
      avgVariancePct: v.n ? v.sum / v.n : 0,
      sampleCount: v.n,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const avgPriceVariancePct =
    varianceSamples.length > 0
      ? varianceSamples.reduce((a, b) => a + b, 0) / varianceSamples.length
      : null;

  return {
    summary: {
      totalCost,
      totalTrans: rows.length,
      avgDailyCost,
      daysWithActivity,
      distinctItems: itemCodes.size,
      distinctSuppliers: suppCodes.size,
      totalQty,
      avgPriceVariancePct,
    },
    byCategory,
    byItem,
    byDate,
    bySupp,
    cumulativeByDate,
    topItemsByValue,
    topItemsByQty,
    priceVarianceByMonth,
    weeklyHeatmap: Object.values(heatmap),
  };
}

export function filterRowsByCategory(
  rows: ReportTxnRow[],
  allowedItemCodes: Set<string> | null
) {
  if (!allowedItemCodes) return rows;
  return rows.filter((t) => allowedItemCodes.has(String(t.item_code)));
}

export function buildCategoryFilter(
  categoryCode: string | undefined,
  itemCategoryMap: Map<string, ItemCategoryCode>
): Set<string> | null {
  const categoryFilter = categoryCode?.trim();
  if (!categoryFilter || !isItemCategoryCode(categoryFilter)) return null;
  return new Set(
    [...itemCategoryMap.entries()]
      .filter(([, cat]) => cat === categoryFilter)
      .map(([itemCode]) => itemCode)
  );
}
