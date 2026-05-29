import type { Locale } from "./types";
import type { ItemPurchaseUnit, UnitOption } from "@/lib/types";

export function unitDisplayName(unit: UnitOption, locale: Locale): string {
  const th = unit.nameTH?.trim() || "";
  const en = unit.nameEN?.trim() || "";
  const kr = unit.nameKR?.trim() || "";
  if (locale === "en") return en || th;
  if (locale === "kr") return kr || en || th;
  return th || en || kr;
}

/** Primary label for DB snapshots (Thai first). */
export function unitPrimaryName(unit: Pick<UnitOption, "nameTH" | "nameEN" | "nameKR">): string {
  return unit.nameTH?.trim() || unit.nameEN?.trim() || unit.nameKR?.trim() || "";
}

/** ป้ายหน่วยซื้อเข้าในฟอร์ม — ใช้ชื่อจาก catalog ตามภาษา */
export function purchaseUnitOptionLabel(
  o: ItemPurchaseUnit,
  units: readonly UnitOption[],
  locale: Locale
): string {
  const catalog = units.find((u) => u.unitCode === o.mainUnitCode);
  if (catalog) return unitDisplayName(catalog, locale);
  const fb = o.mainUnit.trim();
  return fb || "—";
}
