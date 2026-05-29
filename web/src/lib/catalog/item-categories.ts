import type { Locale } from "@/lib/i18n/types";
import type { ItemCategory, ItemCategoryCode } from "@/lib/types";

export type { ItemCategory, ItemCategoryCode };

export const ITEM_CATEGORY_CODES: ItemCategoryCode[] = [
  "PROT",
  "PROD",
  "SEA",
  "PANTRY",
  "BEV",
  "MISC",
];

/** หมวดเริ่มต้นเมื่อสร้างสินค้าใหม่หรือไม่มีค่าใน DB */
export const DEFAULT_ITEM_CATEGORY: ItemCategoryCode = "PANTRY";

/** Used when DB migration not applied yet */
export const FALLBACK_ITEM_CATEGORIES: ItemCategory[] = [
  {
    code: "PROT",
    nameTH: "เนื้อสัตว์และอาหารทะเล",
    nameEN: "Proteins & Seafood",
    nameKR: "육류·해산물",
    sortOrder: 1,
  },
  {
    code: "PROD",
    nameTH: "ผัก ผลไม้ และสมุนไพรสด",
    nameEN: "Fresh Produce & Herbs",
    nameKR: "신선 채소·과일·허브",
    sortOrder: 2,
  },
  {
    code: "SEA",
    nameTH: "เครื่องปรุงและซอส",
    nameEN: "Seasonings & Sauces",
    nameKR: "조미료·소스",
    sortOrder: 3,
  },
  {
    code: "PANTRY",
    nameTH: "ของแห้ง ธัญพืช และเส้น",
    nameEN: "Dry Goods, Grains & Noodles",
    nameKR: "건식·곡물·면류",
    sortOrder: 4,
  },
  {
    code: "BEV",
    nameTH: "เครื่องดื่ม",
    nameEN: "Beverages",
    nameKR: "음료",
    sortOrder: 5,
  },
  {
    code: "MISC",
    nameTH: "ของใช้อื่นๆ",
    nameEN: "Other Supplies",
    nameKR: "기타 용품",
    sortOrder: 6,
  },
];

export function isItemCategoryCode(value: string): value is ItemCategoryCode {
  return ITEM_CATEGORY_CODES.includes(value as ItemCategoryCode);
}

export function itemCategoryDisplayName(
  cat: Pick<ItemCategory, "nameTH" | "nameEN" | "nameKR">,
  locale: Locale
): string {
  if (locale === "en") return cat.nameEN || cat.nameTH;
  if (locale === "kr") return cat.nameKR || cat.nameEN || cat.nameTH;
  return cat.nameTH;
}
