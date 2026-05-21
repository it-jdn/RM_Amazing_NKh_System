import { intakeRowKey } from "@/lib/domain/intake-row-key";
import { extractSlipNoteFromRows } from "@/lib/domain/intake-slip-note";
import type { Item, Mapping, TransactionInput, TransactionRow } from "@/lib/types";
import { loadedNumericField } from "@/lib/utils/numeric-input";

export type HistoryRowVals = Record<string, { qty: string; total: string }>;

export function historyRowsToVals(rows: TransactionRow[]): HistoryRowVals {
  const vals: HistoryRowVals = {};
  for (const r of rows) {
    const key = intakeRowKey(r.itemCode, r.mainUnit);
    vals[key] = {
      qty: loadedNumericField(r.qty),
      total: loadedNumericField(r.totalPrice),
    };
  }
  return vals;
}

export function isHistoryValsDirty(a: HistoryRowVals, b: HistoryRowVals): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k]?.qty ?? "") !== (b[k]?.qty ?? "")) return true;
    if ((a[k]?.total ?? "") !== (b[k]?.total ?? "")) return true;
  }
  return false;
}

export function buildHistoryTransactions(
  vals: HistoryRowVals,
  slipRows: TransactionRow[],
  items: Item[],
  mapping: Mapping[],
  date: string,
  suppCode: string,
  suppName: string,
  slipNote: string
): TransactionInput[] {
  const itemByCode = new Map(items.map((it) => [it.code, it]));
  const priceByItem = new Map(
    mapping.filter((m) => m.suppCode === suppCode).map((m) => [m.itemCode, m.standardUnitPrice] as const)
  );
  const rowByKey = new Map(
    slipRows.map((r) => [intakeRowKey(r.itemCode, r.mainUnit), r] as const)
  );
  const txns: TransactionInput[] = [];

  for (const [key, v] of Object.entries(vals)) {
    const src = rowByKey.get(key);
    if (!src) continue;
    const qty = parseFloat(v.qty) || 0;
    const total = parseFloat(v.total) || 0;
    if (qty <= 0 || total <= 0) continue;

    const item = itemByCode.get(src.itemCode);
    const convertRate = item?.convertRate ?? 1;
    const subUnit = item?.subUnit ?? src.mainUnit;
    const refPrice = priceByItem.get(src.itemCode) ?? src.unitPrice;

    txns.push({
      date,
      suppCode,
      suppName,
      itemCode: src.itemCode,
      itemNameTH: src.itemNameTH || item?.nameTH || src.itemCode,
      qty,
      mainUnit: src.mainUnit,
      convertRate,
      subUnit,
      unitPrice: qty > 0 && total > 0 ? total / qty : refPrice,
      totalPrice: total,
      standardUnitPriceAtSave: refPrice,
      note: slipNote.trim(),
    });
  }

  return txns;
}

export function slipNoteForSave(slipNote: string, rows: TransactionRow[]): string {
  const trimmed = slipNote.trim();
  if (trimmed) return trimmed;
  return extractSlipNoteFromRows(rows);
}
