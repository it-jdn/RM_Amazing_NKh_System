import { itemCategoryDisplayName } from "@/lib/catalog/item-categories";
import { filterItemsByShop } from "@/lib/domain/item-filter";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { Locale } from "@/lib/i18n/types";
import type { Item, ItemCategory, ItemCategoryCode, Mapping, UnitOption } from "@/lib/types";

export type ItemsCatalogSortKey = "code" | "nameTH" | "category" | "shops" | "units";

export function compareItemCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function itemCategoryLabel(
  code: ItemCategoryCode,
  categories: ItemCategory[],
  locale: Locale
) {
  const cat = categories.find((c) => c.code === code);
  return cat ? itemCategoryDisplayName(cat, locale) : code;
}

export function itemUnitSummary(i: Item, units: UnitOption[], locale: Locale) {
  const main = i.mainUnitCode ? units.find((u) => u.unitCode === i.mainUnitCode) : null;
  const sub = i.subUnitCode ? units.find((u) => u.unitCode === i.subUnitCode) : null;
  const mainLabel = main ? unitDisplayName(main, locale) : i.unit;
  const subLabel = sub ? unitDisplayName(sub, locale) : i.subUnit;
  if (!mainLabel && !subLabel) return "—";
  const conv = i.convertRate && i.convertRate !== 1 ? ` (${i.convertRate})` : "";
  return `${mainLabel || "—"} → ${subLabel || "—"}${conv}`;
}

export function itemSubNames(nameEN: string, nameKR: string) {
  const parts = [nameEN, nameKR].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function sortFilterItemsCatalog(params: {
  items: Item[];
  mapping: Mapping[];
  filterSupp: string;
  searchQuery: string;
  sortKey: ItemsCatalogSortKey;
  sortDir: "asc" | "desc";
  itemCategories: ItemCategory[];
  locale: Locale;
  units: UnitOption[];
  linkedShopNames: (itemCode: string) => string[];
  noShopsLabel: string;
}): Item[] {
  let list = filterItemsByShop(params.items, params.mapping, params.filterSupp);

  const q = params.searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((i) => {
      const cat = itemCategoryLabel(i.categoryCode, params.itemCategories, params.locale).toLowerCase();
      const shops = params.linkedShopNames(i.code).join(" ").toLowerCase();
      const units = itemUnitSummary(i, params.units, params.locale).toLowerCase();
      return (
        i.code.toLowerCase().includes(q) ||
        i.nameTH.toLowerCase().includes(q) ||
        i.nameEN.toLowerCase().includes(q) ||
        i.nameKR.toLowerCase().includes(q) ||
        cat.includes(q) ||
        shops.includes(q) ||
        units.includes(q) ||
        params.noShopsLabel.toLowerCase().includes(q)
      );
    });
  }

  const dir = params.sortDir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (params.sortKey) {
      case "code":
        cmp = compareItemCodes(a.code, b.code);
        break;
      case "nameTH":
        cmp = a.nameTH.localeCompare(b.nameTH, params.locale, { sensitivity: "base" });
        break;
      case "category":
        cmp = itemCategoryLabel(a.categoryCode, params.itemCategories, params.locale).localeCompare(
          itemCategoryLabel(b.categoryCode, params.itemCategories, params.locale),
          params.locale,
          { sensitivity: "base" }
        );
        break;
      case "shops": {
        const av = params.linkedShopNames(a.code).join(" · ") || params.noShopsLabel;
        const bv = params.linkedShopNames(b.code).join(" · ") || params.noShopsLabel;
        cmp = av.localeCompare(bv, params.locale, { sensitivity: "base" });
        break;
      }
      case "units":
        cmp = itemUnitSummary(a, params.units, params.locale).localeCompare(
          itemUnitSummary(b, params.units, params.locale),
          params.locale,
          { sensitivity: "base" }
        );
        break;
    }
    return cmp * dir;
  });
}
