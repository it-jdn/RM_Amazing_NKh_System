import type {
  Item,
  ItemPurchaseUnit,
  ItemStandardPurchaseUnit,
  Mapping,
  Supplier,
  UnitOption,
} from "@/lib/types";
import type { Locale } from "@/lib/i18n/types";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";

/** หน่วยมาตรฐานต่อร้าน — เปิด/ปิดรับได้ + ราคา + ลำดับแสดงที่หน้ารับ */
export type ShopStandardRow = {
  mainUnitCode: string;
  intakeEnabled: boolean;
  price: string;
  isDefault: boolean;
  sortOrder: number;
};

export type ShopCfg = {
  enabled: boolean;
  standards: ShopStandardRow[];
};

export function newLocalId() {
  return Math.random().toString(36).slice(2, 11);
}

export function emptyShopCfg(standards: ItemStandardPurchaseUnit[] = []): ShopCfg {
  return {
    enabled: false,
    standards: buildShopStandardsList("", standards),
  };
}

export function itemStandardsSorted(
  itemCode: string,
  standards: ItemStandardPurchaseUnit[]
) {
  return standards
    .filter((s) => s.itemCode === itemCode)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.isDefault ? -1 : 1));
}

/** มาตรฐานจาก DB หรือ fallback จากหน่วยหลักบนสินค้า (กรณีสร้างก่อนมีตารางมาตรฐาน) */
export function effectiveItemPurchaseStandards(
  item: Item | undefined,
  standards: ItemStandardPurchaseUnit[]
): ItemStandardPurchaseUnit[] {
  if (!item) return [];
  const fromDb = itemStandardsSorted(item.code, standards);
  if (fromDb.length) return fromDb;
  if (!item.mainUnitCode || !item.subUnitCode) return [];
  return [
    {
      itemCode: item.code,
      mainUnitCode: item.mainUnitCode,
      subUnitCode: item.subUnitCode,
      mainUnit: item.unit || item.mainUnitCode,
      subUnit: item.subUnit || item.subUnitCode,
      convertRate: item.convertRate ?? 1,
      isDefault: true,
      sortOrder: 0,
      active: true,
    },
  ];
}

export function buildShopStandardsList(
  itemCode: string,
  standards: ItemStandardPurchaseUnit[],
  existing?: ShopStandardRow[]
): ShopStandardRow[] {
  const sorted = itemStandardsSorted(itemCode, standards);
  const byMain = new Map((existing || []).map((r) => [r.mainUnitCode, r]));
  return sorted.map((st, i) => {
    const ex = byMain.get(st.mainUnitCode);
    return {
      mainUnitCode: st.mainUnitCode,
      intakeEnabled: ex?.intakeEnabled ?? false,
      price: ex?.price ?? "",
      isDefault: ex?.isDefault ?? st.isDefault,
      sortOrder: ex?.sortOrder ?? i,
    };
  });
}

export function normalizeShopStandards(rows: ShopStandardRow[]): ShopStandardRow[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const enabled = sorted.filter((r) => r.intakeEnabled);
  if (!enabled.length) {
    return sorted.map((r, i) => ({ ...r, sortOrder: i, isDefault: i === 0 && sorted.length === 1 }));
  }
  const defMain =
    enabled.find((r) => r.isDefault)?.mainUnitCode ?? enabled[0].mainUnitCode;
  return sorted.map((r, i) => ({
    ...r,
    sortOrder: i,
    isDefault: r.intakeEnabled && r.mainUnitCode === defMain,
  }));
}

export function resolveStandard(
  standards: ItemStandardPurchaseUnit[],
  itemCode: string,
  mainUnitCode: string
) {
  return standards.find((s) => s.itemCode === itemCode && s.mainUnitCode === mainUnitCode);
}

export function loadShopCfgForItem(
  itemCode: string,
  suppliers: Supplier[],
  mapping: Mapping[],
  purchaseUnits: ItemPurchaseUnit[],
  standards: ItemStandardPurchaseUnit[]
): Record<string, ShopCfg> {
  const next: Record<string, ShopCfg> = {};
  const itemStds = itemStandardsSorted(itemCode, standards);

  for (const s of suppliers) {
    const rows = purchaseUnits.filter((p) => p.suppCode === s.code && p.itemCode === itemCode);
    if (rows.length) {
      const existing: ShopStandardRow[] = rows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p, i) => ({
          mainUnitCode: p.mainUnitCode,
          intakeEnabled: true,
          price: String(p.standardUnitPrice ?? 0),
          isDefault: p.isDefault,
          sortOrder: p.sortOrder ?? i,
        }));
      const merged = buildShopStandardsList(itemCode, standards, existing);
      for (const st of itemStds) {
        const row = merged.find((r) => r.mainUnitCode === st.mainUnitCode);
        if (row && !existing.some((e) => e.mainUnitCode === st.mainUnitCode)) {
          row.intakeEnabled = false;
        }
      }
      next[s.code] = { enabled: true, standards: normalizeShopStandards(merged) };
      continue;
    }

    const m = mapping.find((x) => x.suppCode === s.code && x.itemCode === itemCode);
    if (m?.mainUnitCode) {
      const base = buildShopStandardsList(itemCode, standards);
      const merged = base.map((r) => ({
        ...r,
        intakeEnabled: r.mainUnitCode === m.mainUnitCode,
        price:
          r.mainUnitCode === m.mainUnitCode
            ? String(m.standardUnitPrice ?? m.unitPrice ?? "")
            : r.price,
        isDefault: r.mainUnitCode === m.mainUnitCode,
      }));
      next[s.code] = { enabled: true, standards: normalizeShopStandards(merged) };
    } else {
      next[s.code] = emptyShopCfg(standards);
    }
  }

  return next;
}

export function shopProductConfigsFromCfg(
  itemCode: string,
  shopCfg: Record<string, ShopCfg>,
  suppliers: Supplier[],
  standards: ItemStandardPurchaseUnit[],
  units: UnitOption[],
  locale: Locale
) {
  return suppliers
    .filter((s) => shopCfg[s.code]?.enabled)
    .map((s) => {
      const c = shopCfg[s.code];
      const purchaseUnitRows = normalizeShopStandards(c.standards)
        .filter((row) => row.intakeEnabled)
        .map((row, i) => {
          const std = resolveStandard(standards, itemCode, row.mainUnitCode);
          if (!std) return null;
          const mainU = units.find((u) => u.unitCode === std.mainUnitCode);
          const subU = units.find((u) => u.unitCode === std.subUnitCode);
          return {
            mainUnitCode: std.mainUnitCode,
            subUnitCode: std.subUnitCode,
            mainUnit: mainU ? unitDisplayName(mainU, locale) : std.mainUnit,
            subUnit: subU ? unitDisplayName(subU, locale) : std.subUnit,
            convertRate: std.convertRate,
            standardUnitPrice: parseFloat(row.price) || 0,
            isDefault: row.isDefault,
            sortOrder: i,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      return { suppCode: s.code, purchaseUnits: purchaseUnitRows };
    });
}

export function validateShopCfg(shopCfg: Record<string, ShopCfg>): string | null {
  for (const [code, cfg] of Object.entries(shopCfg)) {
    if (!cfg.enabled) continue;
    const enabled = cfg.standards.filter((r) => r.intakeEnabled);
    if (!enabled.length) {
      return `❌ เลือกอย่างน้อย 1 หน่วยรับเข้าต่อร้าน (${code})`;
    }
    if (!enabled.some((r) => r.isDefault)) {
      return `❌ เลือกหน่วยที่หน้ารับสินค้าสำหรับร้าน ${code}`;
    }
    for (const r of enabled) {
      if (!r.mainUnitCode) return "❌ หน่วยไม่ครบ";
    }
  }
  return null;
}
