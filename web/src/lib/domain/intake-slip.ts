import type { TransactionRow } from "@/lib/types";

/** ค่า saved_at ล่าสุดของใบ (วัน+ร้าน) สำหรับตรวจการบันทึกทับ */
export function maxSavedAtFromRows(rows: { savedAt?: string }[]): string {
  let max = "";
  for (const r of rows) {
    const at = r.savedAt?.trim() || "";
    if (at && at >= max) max = at;
  }
  return max;
}

export function isServerSlipNewer(serverMax: string, loadedSnapshot: string): boolean {
  if (!serverMax) return false;
  if (!loadedSnapshot) return true;
  return serverMax > loadedSnapshot;
}

export type IntakeSlipMeta = {
  exists: boolean;
  maxSavedAt: string;
  savedByName: string;
  rowCount: number;
  productCount: number;
  hasDuplicateRows: boolean;
};

export function slipMetaFromRows(rows: TransactionRow[]): IntakeSlipMeta {
  if (!rows.length) {
    return {
      exists: false,
      maxSavedAt: "",
      savedByName: "",
      rowCount: 0,
      productCount: 0,
      hasDuplicateRows: false,
    };
  }
  let maxSavedAt = "";
  let savedByName = "";
  for (const r of rows) {
    if (r.savedAt && r.savedAt >= maxSavedAt) {
      maxSavedAt = r.savedAt;
      savedByName = r.savedByName || savedByName;
    }
  }
  const productCount = new Set(rows.map((r) => r.itemCode)).size;
  return {
    exists: true,
    maxSavedAt,
    savedByName,
    rowCount: rows.length,
    productCount,
    hasDuplicateRows: rows.length > productCount,
  };
}
