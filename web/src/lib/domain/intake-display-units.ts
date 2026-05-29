import type { Locale } from "@/lib/i18n/types";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { ItemPurchaseUnit, UnitOption } from "@/lib/types";

/** Resolve unit label from catalog code, else legacy snapshot text. */
export function unitLabelByCode(
  unitCode: string | undefined,
  fallbackText: string | undefined,
  units: readonly UnitOption[],
  locale: Locale
): string {
  const code = unitCode?.trim();
  if (code) {
    const row = units.find((u) => u.unitCode === code);
    if (row) return unitDisplayName(row, locale);
  }
  const fb = fallbackText?.trim();
  return fb || "—";
}

export function selectedPurchaseUnitOption(
  options: readonly ItemPurchaseUnit[],
  mainUnitCode: string
): ItemPurchaseUnit | undefined {
  return options.find((o) => o.mainUnitCode === mainUnitCode) ?? options[0];
}

export function labelsForPurchaseUnit(
  option: ItemPurchaseUnit | undefined,
  units: readonly UnitOption[],
  locale: Locale
): { main: string; sub: string } {
  if (!option) return { main: "—", sub: "—" };
  return {
    main: unitLabelByCode(option.mainUnitCode, option.mainUnit, units, locale),
    sub: unitLabelByCode(option.subUnitCode, option.subUnit, units, locale),
  };
}
