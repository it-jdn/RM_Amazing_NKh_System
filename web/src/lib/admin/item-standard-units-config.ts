import type { Item, ItemStandardPurchaseUnit } from "@/lib/types";

export type StandardUnitRow = {
  localId: string;
  mainUnitCode: string;
  subUnitCode: string;
  convertRate: string;
  isDefault: boolean;
};

export function newLocalId() {
  return Math.random().toString(36).slice(2, 11);
}

export function emptyStandardRow(isDefault = false): StandardUnitRow {
  return {
    localId: newLocalId(),
    mainUnitCode: "",
    subUnitCode: "",
    convertRate: "1",
    isDefault,
  };
}

export function standardRowFromItem(item: Item, isDefault = true): StandardUnitRow {
  return {
    localId: newLocalId(),
    mainUnitCode: item.mainUnitCode || "",
    subUnitCode: item.subUnitCode || "",
    convertRate: String(item.convertRate ?? 1),
    isDefault,
  };
}

export function loadStandardRowsForItem(
  itemCode: string,
  item: Item | undefined,
  standards: ItemStandardPurchaseUnit[]
): StandardUnitRow[] {
  const fromDb = standards
    .filter((s) => s.itemCode === itemCode)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.isDefault ? -1 : 1));

  if (fromDb.length) {
    return normalizeStandardRows(
      fromDb.map((s) => ({
        localId: newLocalId(),
        mainUnitCode: s.mainUnitCode,
        subUnitCode: s.subUnitCode,
        convertRate: String(s.convertRate ?? 1),
        isDefault: s.isDefault,
      }))
    );
  }

  if (item?.mainUnitCode && item.subUnitCode) {
    return [standardRowFromItem(item, true)];
  }

  return [emptyStandardRow(true)];
}

/** หน่วยเดียว = default เสมอ; หลายหน่วย = ต้องมี default หนึ่งแถว */
/** แถวมาตรฐานที่ใช้ sync กับตาราง items (ไม่ใช่แถวแรกในลิสต์เสมอ) */
export function defaultStandardRow(rows: StandardUnitRow[]): StandardUnitRow | undefined {
  if (!rows.length) return undefined;
  return rows.find((r) => r.isDefault) ?? rows[0];
}

export function normalizeStandardRows(rows: StandardUnitRow[]): StandardUnitRow[] {
  if (!rows.length) return rows;
  if (rows.length === 1) {
    return [{ ...rows[0], isDefault: true }];
  }
  const defIdx = rows.findIndex((r) => r.isDefault);
  const pick = defIdx >= 0 ? defIdx : 0;
  return rows.map((r, i) => ({ ...r, isDefault: i === pick }));
}

/** เติมแถวแรกจากข้อมูลสินค้าเดิม ถ้ายังว่าง (กรณี DB ยังไม่มีมาตรฐาน) */
export function initStandardRowsForEdit(
  item: Item,
  standards: ItemStandardPurchaseUnit[]
): StandardUnitRow[] {
  let rows = loadStandardRowsForItem(item.code, item, standards);
  if (
    rows.length === 1 &&
    item.mainUnitCode &&
    item.subUnitCode &&
    (!rows[0].mainUnitCode || !rows[0].subUnitCode)
  ) {
    rows = [standardRowFromItem(item, true)];
  }
  return normalizeStandardRows(rows);
}

export function standardPayloadFromRows(rows: StandardUnitRow[]) {
  const normalized = normalizeStandardRows(rows);
  return normalized.map((row, i) => ({
    mainUnitCode: String(row.mainUnitCode || "").trim(),
    subUnitCode: String(row.subUnitCode || "").trim(),
    convertRate: parseFloat(row.convertRate) || 1,
    isDefault: row.isDefault,
    sortOrder: i,
  }));
}

export function validateStandardRows(rows: StandardUnitRow[]): string | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!String(row.mainUnitCode || "").trim() || !String(row.subUnitCode || "").trim()) {
      return "❌ กรุณาเลือกหน่วยซื้อเข้าและหน่วยย่อยให้ครบทุกแถว";
    }
    const rate = parseFloat(row.convertRate) || 0;
    if (rate <= 0) return "❌ อัตราแปลงหน่วยต้องมากกว่า 0";
  }
  const mains = rows.map((r) => String(r.mainUnitCode || "").trim()).filter(Boolean);
  if (new Set(mains).size !== mains.length) {
    return "❌ หน่วยซื้อเข้าหลักซ้ำกัน — แต่ละแถวต้องใช้หน่วยหลักคนละตัว";
  }

  const signatures = rows.map((r) => {
    const main = String(r.mainUnitCode || "").trim();
    const sub = String(r.subUnitCode || "").trim();
    const rate = parseFloat(r.convertRate) || 0;
    return `${main}|${sub}|${rate}`;
  });
  if (new Set(signatures).size !== signatures.length) {
    return "❌ ชุดหน่วยและค่าแปลงซ้ำกัน — แต่ละแถวต้องไม่ซ้ำกัน";
  }

  return null;
}
