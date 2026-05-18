import type { ItemPurchaseUnit, ItemStandardPurchaseUnit, Mapping } from "@/lib/types";

function sortPurchaseOptions(rows: ItemPurchaseUnit[]) {
  return [...rows].sort(
    (a, b) =>
      (a.isDefault ? 0 : 1) - (b.isDefault ? 0 : 1) ||
      a.sortOrder - b.sortOrder ||
      a.mainUnit.localeCompare(b.mainUnit)
  );
}

/** ตัวเลือกหน่วยซื้อเข้าตอนรับสินค้า — รวมมาตรฐานสินค้ากับราคาที่เปิดต่อร้าน */
export function purchaseUnitsForItem(
  purchaseUnits: ItemPurchaseUnit[],
  itemStandards: ItemStandardPurchaseUnit[],
  suppCode: string,
  itemCode: string,
  mappingFallback?: Mapping
): ItemPurchaseUnit[] {
  const standards = itemStandards
    .filter((s) => s.itemCode === itemCode && s.active !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.isDefault ? -1 : 1));

  const shopRows = purchaseUnits.filter(
    (p) => p.suppCode === suppCode && p.itemCode === itemCode && p.active !== false
  );

  if (standards.length && mappingFallback) {
    const shopByMain = new Map(shopRows.map((r) => [r.mainUnitCode, r]));
    const enabledMains =
      shopRows.length > 0 ? new Set(shopRows.map((r) => r.mainUnitCode)) : null;

    const defaultMain =
      shopRows.find((r) => r.isDefault)?.mainUnitCode ??
      standards.find((s) => s.isDefault)?.mainUnitCode ??
      mappingFallback.mainUnitCode;

    const merged = standards
      .filter((s) => !enabledMains || enabledMains.has(s.mainUnitCode))
      .map((s) => {
        const shop = shopByMain.get(s.mainUnitCode);
        return {
          suppCode,
          itemCode,
          mainUnitCode: s.mainUnitCode,
          subUnitCode: s.subUnitCode,
          mainUnit: shop?.mainUnit ?? s.mainUnit,
          subUnit: shop?.subUnit ?? s.subUnit,
          convertRate: shop?.convertRate ?? s.convertRate,
          standardUnitPrice:
            shop?.standardUnitPrice ??
            (s.mainUnitCode === mappingFallback.mainUnitCode
              ? mappingFallback.standardUnitPrice
              : 0),
          isDefault: s.mainUnitCode === defaultMain,
          sortOrder: shop?.sortOrder ?? s.sortOrder,
          active: true,
        } satisfies ItemPurchaseUnit;
      });

    if (merged.length) return sortPurchaseOptions(merged);
  }

  if (shopRows.length) return sortPurchaseOptions(shopRows);

  if (mappingFallback?.mainUnitCode && mappingFallback.subUnitCode) {
    return [
      {
        suppCode,
        itemCode,
        mainUnitCode: mappingFallback.mainUnitCode,
        subUnitCode: mappingFallback.subUnitCode,
        mainUnit: mappingFallback.mainUnit,
        subUnit: mappingFallback.subUnit,
        convertRate: mappingFallback.convertRate,
        standardUnitPrice: mappingFallback.standardUnitPrice,
        isDefault: true,
        sortOrder: 0,
        active: true,
      },
    ];
  }

  return [];
}

export function defaultPurchaseUnit(options: ItemPurchaseUnit[]): ItemPurchaseUnit | undefined {
  return options.find((o) => o.isDefault) ?? options[0];
}

export function formatPurchaseUnitOptionLabel(o: ItemPurchaseUnit) {
  if (o.subUnit && o.convertRate && o.convertRate !== 1) {
    return `${o.mainUnit} → ${o.subUnit} (×${o.convertRate})`;
  }
  return o.mainUnit;
}
