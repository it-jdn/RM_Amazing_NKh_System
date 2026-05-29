import type { TransactionInput, TransactionRow } from "@/lib/types";
import { intakeRowKey } from "@/lib/domain/intake-row-key";

function aggregateKey(t: TransactionRow) {
  return intakeRowKey(t.itemCode, String(t.mainUnit || "").trim());
}

function isNewerSavedAt(a?: string, b?: string) {
  if (!b) return false;
  if (!a) return true;
  return String(b) > String(a);
}

/** บันทึกล่าสุดในกลุ่มแถว (ใช้แสดงผู้บันทึก/เวลาในประวัติ) */
export function latestTransactionAudit(rows: TransactionRow[]): {
  savedAt?: string;
  savedByName?: string;
} | null {
  let best: TransactionRow | null = null;
  for (const r of rows) {
    if (!r.savedAt && !r.savedByName) continue;
    if (!best || isNewerSavedAt(best.savedAt, r.savedAt)) best = r;
  }
  if (!best) return null;
  return { savedAt: best.savedAt, savedByName: best.savedByName };
}

function applyLatestAudit(target: TransactionRow, incoming: TransactionRow) {
  if (isNewerSavedAt(target.savedAt, incoming.savedAt)) {
    target.savedAt = incoming.savedAt;
    target.savedByName = incoming.savedByName;
  }
}

/** รวมหลายบันทึกของสินค้า+หน่วยเดียวกัน (วัน+ร้านเดียวกัน) เป็นยอดเดียว */
export function aggregateTransactionsByItem(rows: TransactionRow[]): TransactionRow[] {
  const map = new Map<string, { row: TransactionRow; notes: string[] }>();

  for (const t of rows) {
    const qty = parseFloat(String(t.qty)) || 0;
    const total = parseFloat(String(t.totalPrice)) || 0;
    const key = aggregateKey(t);
    const cur = map.get(key);

    if (!cur) {
      map.set(key, {
        row: {
          ...t,
          qty,
          totalPrice: total,
          unitPrice:
            qty > 0 && total > 0 ? Math.round((total / qty) * 100) / 100 : t.unitPrice,
          note: t.note || "",
        },
        notes: t.note?.trim() ? [t.note.trim()] : [],
      });
      continue;
    }

    const sumQty = (parseFloat(String(cur.row.qty)) || 0) + qty;
    const sumTotal = (parseFloat(String(cur.row.totalPrice)) || 0) + total;
    cur.row.qty = sumQty;
    cur.row.totalPrice = sumTotal;
    cur.row.unitPrice =
      sumQty > 0 && sumTotal > 0
        ? Math.round((sumTotal / sumQty) * 100) / 100
        : cur.row.unitPrice;
    if (t.note?.trim()) cur.notes.push(t.note.trim());
    cur.row.note = [...new Set(cur.notes)].join("; ");
    applyLatestAudit(cur.row, t);
  }

  return Array.from(map.values()).map((c) => c.row);
}

/** รวมรายการที่จะบันทึก — ป้องกันแถวซ้ำ item+หน่วยในชุดเดียวกัน */
export function dedupeTransactionInputs(transactions: TransactionInput[]): TransactionInput[] {
  const map = new Map<string, TransactionInput>();

  for (const t of transactions) {
    const mainUnit = String(t.mainUnit || "").trim();
    const key = intakeRowKey(t.itemCode, mainUnit);
    const qty = parseFloat(String(t.qty)) || 0;
    const total = parseFloat(String(t.totalPrice)) || 0;
    const cur = map.get(key);

    if (!cur) {
      map.set(key, { ...t, mainUnit, qty, totalPrice: total });
      continue;
    }

    const sumQty = (parseFloat(String(cur.qty)) || 0) + qty;
    const sumTotal = (parseFloat(String(cur.totalPrice)) || 0) + total;
    cur.qty = sumQty;
    cur.totalPrice = sumTotal;
    cur.mainUnit = mainUnit;
    cur.unitPrice =
      sumQty > 0 && sumTotal > 0
        ? Math.round((sumTotal / sumQty) * 100) / 100
        : cur.unitPrice;
  }

  return [...map.values()];
}

export function computeRowFields(
  qty: number,
  convertRate: number,
  totalPrice: number,
  fallbackUnitPrice = 0
) {
  const totalSub = Math.round(qty * convertRate * 100) / 100;
  const unitPrice =
    qty > 0 && totalPrice > 0
      ? Math.round((totalPrice / qty) * 100) / 100
      : fallbackUnitPrice;
  return { totalSub, unitPrice };
}

export function buildTransactionRow(
  t: TransactionInput,
  no: number,
  savedAt: string,
  audit?: { userId: string; displayName: string },
  slipId?: string | null
) {
  const qty = parseFloat(String(t.qty)) || 0;
  const convert = parseFloat(String(t.convertRate)) || 1;
  const totalPrice = parseFloat(String(t.totalPrice)) || 0;
  const fallbackUP = parseFloat(String(t.unitPrice)) || 0;
  const { totalSub, unitPrice } = computeRowFields(qty, convert, totalPrice, fallbackUP);

  return {
    no,
    txn_date: t.date,
    supp_code: t.suppCode,
    supp_name: t.suppName,
    item_code: t.itemCode,
    item_name_th: t.itemNameTH,
    qty,
    main_unit: String(t.mainUnit || "").trim(),
    convert_rate: convert,
    sub_unit: t.subUnit,
    total_sub: totalSub,
    unit_price: unitPrice,
    total_price: totalPrice,
    standard_unit_price_at_save:
      t.standardUnitPriceAtSave != null ? parseFloat(String(t.standardUnitPriceAtSave)) : null,
    note: t.note || "",
    saved_at: savedAt,
    saved_by_user_id: audit?.userId || null,
    saved_by_name: audit?.displayName || "",
    slip_id: slipId || null,
  };
}

export function calcMappingPrice(t: TransactionInput): number | null {
  const qty = parseFloat(String(t.qty)) || 0;
  const total = parseFloat(String(t.totalPrice)) || 0;
  if (qty <= 0) return null;
  if (total <= 0 && !t.unitPrice) return null;
  const calc = total > 0 ? Math.round((total / qty) * 100) / 100 : parseFloat(String(t.unitPrice)) || 0;
  return calc > 0 ? calc : null;
}

export async function generateItemCode(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>
): Promise<string> {
  const { data } = await supabase.from("items").select("item_code");
  const codes = (data || [])
    .map((r) => String(r.item_code))
    .filter((c) => /^RM\d+$/.test(c));
  const nums = codes.map((c) => parseInt(c.replace("RM", ""), 10)).filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return "RM" + String(next).padStart(5, "0");
}

/** ISO date with Buddhist year in DB/import (e.g. 2569-05-29) → CE (2026-05-29). */
export function normalizeTxnDateISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (!m) return iso.slice(0, 10);
  const y = parseInt(m[1], 10);
  if (y >= 2400 && y <= 2800) return `${y - 543}-${m[2]}-${m[3]}`;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    return normalizeTxnDateISO(
      val.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })
    );
  }
  const s = String(val).trim();
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dm) {
    const y = parseInt(dm[3], 10);
    const ceYear = y >= 2400 && y <= 2800 ? y - 543 : y;
    return normalizeTxnDateISO(
      `${ceYear}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`
    );
  }
  return normalizeTxnDateISO(s);
}

/**
 * Current wall time in Asia/Bangkok as an unambiguous timestamptz string for Postgres.
 * (Naive `sv-SE` strings without offset were often interpreted as UTC by the remote DB,
 * shifting displayed times by several hours.)
 */
export function bangkokNow(): string {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "00";
  const y = g("year");
  const mo = g("month");
  const da = g("day");
  const h = g("hour");
  const mi = g("minute");
  const s = g("second");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${y}-${mo}-${da}T${h}:${mi}:${s}.${ms}+07:00`;
}
