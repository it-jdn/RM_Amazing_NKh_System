import { slipMetaFromRows } from "@/lib/domain/intake-slip";
import {
  buildTransactionRow,
  bangkokNow,
  toDateStr,
} from "@/lib/domain/transactions";
import { extractSlipNoteFromRows } from "@/lib/domain/intake-slip-note";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IntakeSlipSummary, SaveAudit, TransactionInput, TransactionRow } from "@/lib/types";

function mapSlipRow(
  s: Record<string, unknown>,
  stats?: { lineCount: number; productCount: number; totalPrice: number }
): IntakeSlipSummary {
  return {
    id: String(s.id),
    date: toDateStr(s.txn_date),
    suppCode: String(s.supp_code),
    suppName: String(s.supp_name || ""),
    slipNote: String(s.slip_note || ""),
    createdAt: String(s.created_at),
    createdByUserId: s.created_by_user_id ? String(s.created_by_user_id) : null,
    createdByName: String(s.created_by_name || ""),
    updatedAt: String(s.updated_at),
    updatedByUserId: s.updated_by_user_id ? String(s.updated_by_user_id) : null,
    updatedByName: String(s.updated_by_name || ""),
    lineCount: stats?.lineCount ?? 0,
    productCount: stats?.productCount ?? 0,
    totalPrice: stats?.totalPrice ?? 0,
  };
}

async function slipStats(
  supabase: ReturnType<typeof createAdminClient>,
  slipIds: string[]
) {
  const map = new Map<string, { lineCount: number; productCount: number; totalPrice: number }>();
  if (!slipIds.length) return map;

  const { data, error } = await supabase
    .from("transactions")
    .select("slip_id, item_code, total_price")
    .in("slip_id", slipIds);
  if (error) throw error;

  const itemsBySlip = new Map<string, Set<string>>();
  for (const r of data || []) {
    const id = String(r.slip_id);
    if (!id) continue;
    const cur = map.get(id) ?? { lineCount: 0, productCount: 0, totalPrice: 0 };
    cur.lineCount += 1;
    cur.totalPrice += parseFloat(String(r.total_price)) || 0;
    map.set(id, cur);
    const items = itemsBySlip.get(id) ?? new Set<string>();
    items.add(String(r.item_code));
    itemsBySlip.set(id, items);
  }
  for (const [id, items] of itemsBySlip) {
    const cur = map.get(id);
    if (cur) cur.productCount = items.size;
  }
  return map;
}

export async function listIntakeSlips(filters: {
  dateFrom?: string;
  dateTo?: string;
  suppCode?: string;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("intake_slips")
    .select(
      "id, txn_date, supp_code, supp_name, slip_note, created_at, created_by_user_id, created_by_name, updated_at, updated_by_user_id, updated_by_name"
    );

  if (filters.suppCode) query = query.eq("supp_code", filters.suppCode);
  if (filters.dateFrom) query = query.gte("txn_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("txn_date", filters.dateTo);

  const { data, error } = await query
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (data || []).map((r) => String(r.id));
  const stats = await slipStats(supabase, ids);

  return {
    success: true,
    slips: (data || []).map((r) =>
      mapSlipRow(r as Record<string, unknown>, stats.get(String(r.id)))
    ),
  };
}

export async function getIntakeSlipById(slipId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("intake_slips")
    .select(
      "id, txn_date, supp_code, supp_name, slip_note, created_at, created_by_user_id, created_by_name, updated_at, updated_by_user_id, updated_by_name"
    )
    .eq("id", slipId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { success: true, slip: null as IntakeSlipSummary | null };

  const stats = await slipStats(supabase, [slipId]);
  return { success: true, slip: mapSlipRow(data as Record<string, unknown>, stats.get(slipId)) };
}

export async function getTransactionRowsForSlip(slipId: string): Promise<TransactionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "no, slip_id, txn_date, supp_code, supp_name, item_code, item_name_th, qty, main_unit, unit_price, total_price, note, saved_at, saved_by_name"
    )
    .eq("slip_id", slipId)
    .order("no", { ascending: true });
  if (error) throw error;

  return (data || []).map((r) => ({
    no: r.no != null ? Number(r.no) : undefined,
    slipId: r.slip_id ? String(r.slip_id) : undefined,
    date: toDateStr(r.txn_date),
    suppCode: String(r.supp_code),
    suppName: String(r.supp_name),
    itemCode: String(r.item_code),
    itemNameTH: String(r.item_name_th),
    qty: parseFloat(String(r.qty)) || 0,
    mainUnit: String(r.main_unit || ""),
    unitPrice: parseFloat(String(r.unit_price)) || 0,
    totalPrice: parseFloat(String(r.total_price)) || 0,
    note: String(r.note || ""),
    savedAt: r.saved_at ? String(r.saved_at) : undefined,
    savedByName: String(r.saved_by_name || ""),
  }));
}

async function getLastTransactionNo(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from("transactions")
    .select("no")
    .order("no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.no ? Number(data.no) : 0;
}

export async function saveIntakeSlipRecord(params: {
  slipId?: string | null;
  transactions: TransactionInput[];
  slipNote?: string;
  audit?: SaveAudit;
}) {
  const { transactions, audit } = params;
  if (!transactions?.length) {
    return { ok: false as const, message: "❌ ไม่มีรายการส่งมา", replaced: false };
  }

  const date = transactions[0].date;
  const suppCode = transactions[0].suppCode;
  const suppName = transactions[0].suppName;
  for (const t of transactions) {
    if (t.date !== date || t.suppCode !== suppCode) {
      return { ok: false as const, message: "❌ รายการต้องเป็นวันและร้านเดียวกัน", replaced: false };
    }
  }

  const supabase = createAdminClient();
  const now = bangkokNow();
  const note = (params.slipNote ?? transactions[0].note ?? "").trim();
  let slipId = params.slipId?.trim() || "";

  if (slipId) {
    const { data: slip, error: slipErr } = await supabase
      .from("intake_slips")
      .select("id")
      .eq("id", slipId)
      .maybeSingle();
    if (slipErr) throw slipErr;
    if (!slip) return { ok: false as const, message: "❌ ไม่พบใบรับสินค้า", replaced: false };

    const { error: updErr } = await supabase
      .from("intake_slips")
      .update({
        slip_note: note,
        updated_at: now,
        updated_by_user_id: audit?.userId || null,
        updated_by_name: audit?.displayName || "",
        supp_name: suppName,
      })
      .eq("id", slipId);
    if (updErr) throw updErr;

    const { error: delErr } = await supabase.from("transactions").delete().eq("slip_id", slipId);
    if (delErr) throw delErr;
  } else {
    const { data: created, error: insErr } = await supabase
      .from("intake_slips")
      .insert({
        txn_date: date,
        supp_code: suppCode,
        supp_name: suppName,
        slip_note: note,
        created_at: now,
        created_by_user_id: audit?.userId || null,
        created_by_name: audit?.displayName || "",
        updated_at: now,
        updated_by_user_id: audit?.userId || null,
        updated_by_name: audit?.displayName || "",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    slipId = String(created.id);
  }

  let lastNo = await getLastTransactionNo(supabase);
  const rows = transactions.map((t) => {
    lastNo += 1;
    return buildTransactionRow({ ...t, note: note }, lastNo, now, audit, slipId);
  });

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw error;

  const first = rows[0].no;
  const last = rows[rows.length - 1].no;
  const isUpdate = Boolean(params.slipId?.trim());

  return {
    ok: true as const,
    message: isUpdate
      ? `✅ อัปเดตใบรับสินค้าสำเร็จ ${rows.length} รายการ (no.${first}–${last})`
      : `✅ บันทึกใบรับสินค้าใหม่ ${rows.length} รายการ (no.${first}–${last})`,
    replaced: isUpdate,
    slipId,
  };
}

export async function deleteIntakeSlipById(slipId: string) {
  const supabase = createAdminClient();
  const { count, error: cntErr } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("slip_id", slipId);
  if (cntErr) throw cntErr;

  const { error } = await supabase.from("intake_slips").delete().eq("id", slipId);
  if (error) throw error;

  return { success: true, deleted: count ?? 0 };
}

export async function getIntakeSlipMetaById(slipId: string) {
  const slipRes = await getIntakeSlipById(slipId);
  if (!slipRes.slip) {
    return {
      exists: false,
      maxSavedAt: "",
      savedByName: "",
      rowCount: 0,
      productCount: 0,
      hasDuplicateRows: false,
      slip: null,
    };
  }
  const rows = await getTransactionRowsForSlip(slipId);
  const meta = slipMetaFromRows(rows);
  return {
    ...meta,
    maxSavedAt: slipRes.slip.updatedAt,
    savedByName: slipRes.slip.updatedByName || slipRes.slip.createdByName,
    slip: slipRes.slip,
  };
}

export function slipNoteFromSlipOrRows(slipNote: string, rows: TransactionRow[]) {
  const trimmed = slipNote.trim();
  if (trimmed) return trimmed;
  return extractSlipNoteFromRows(rows);
}
