import { createAdminClient } from "@/lib/supabase/admin";
import {
  bangkokNow,
  buildTransactionRow,
  calcMappingPrice,
  generateItemCode,
  toDateStr,
} from "@/lib/domain/transactions";
import { slipMetaFromRows } from "@/lib/domain/intake-slip";
import {
  insertMappingPriceHistory,
  recordItemVersion,
  recordMappingVersion,
} from "@/lib/services/catalog-history";
import { FALLBACK_ITEM_CATEGORIES, isItemCategoryCode } from "@/lib/catalog/item-categories";
import { unitPrimaryName } from "@/lib/i18n/unit-display-name";
import { formatPostgresError } from "@/lib/db/postgres-error";
import { itemsTableHasCategoryCode } from "@/lib/db/schema-support";
import { listMasterUnits, resolveUnitCode } from "@/lib/services/units";
import {
  aggregateReportRows,
  buildCategoryFilter,
  filterRowsByCategory,
  type ReportTxnRow,
} from "@/lib/reports/aggregate";
import { reportDataDateRange } from "@/lib/reports/date-range";
import { previousPeriodRange, pctChange } from "@/lib/reports/period";
import type {
  ItemCategory,
  ItemCategoryCode,
  ItemPurchaseUnit,
  ItemStandardPurchaseUnit,
  ReportFilters,
  SaveAudit,
  TransactionInput,
  UnitOption,
} from "@/lib/types";

const DEFAULT_ITEM_CATEGORY: ItemCategoryCode = "PANTRY";

function isMissingRelationError(err: { code?: string; message?: string }) {
  const code = String(err.code || "");
  const msg = String(err.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("Could not find the table")
  );
}

export async function listItemCategories(): Promise<ItemCategory[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("item_categories")
    .select("category_code, name_th, name_en, name_kr, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return FALLBACK_ITEM_CATEGORIES;
  const rows = data || [];
  if (!rows.length) return FALLBACK_ITEM_CATEGORIES;
  return rows.map((r) => ({
    code: String(r.category_code) as ItemCategoryCode,
    nameTH: String(r.name_th || ""),
    nameEN: String(r.name_en || ""),
    nameKR: String(r.name_kr || ""),
    sortOrder: Number(r.sort_order) || 0,
  }));
}

export async function getInitialData(options?: { includeInactiveSuppliers?: boolean }) {
  const supabase = createAdminClient();

  let suppQuery = supabase.from("suppliers").select("*").order("sort_order").order("supp_code");
  if (!options?.includeInactiveSuppliers) {
    suppQuery = suppQuery.eq("active", true);
  }

  const [suppRes, itemsRes, mapRes, puRes, ipuRes, categories] = await Promise.all([
    suppQuery,
    supabase.from("items").select("*").order("item_code"),
    supabase.from("supplier_item_mapping").select("*"),
    supabase.from("supplier_item_purchase_units").select("*"),
    supabase.from("item_purchase_units").select("*"),
    listItemCategories().catch(() => [] as ItemCategory[]),
  ]);

  if (suppRes.error) throw suppRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (mapRes.error) throw mapRes.error;
  if (puRes.error) throw puRes.error;
  if (ipuRes.error && !isMissingRelationError(ipuRes.error)) throw ipuRes.error;

  let units: UnitOption[] = [];
  try {
    units = await listMasterUnits();
  } catch {
    units = [];
  }

  const unitNames = new Map(units.map((u) => [u.unitCode, unitPrimaryName(u)]));

  function unitLabel(code: string | null | undefined, fallback: string) {
    if (code && unitNames.has(String(code))) return unitNames.get(String(code))!;
    return fallback;
  }

  return {
    success: true,
    suppliers: (suppRes.data || []).map((s) => ({
      code: String(s.supp_code),
      nameTH: String(s.supp_name || ""),
      nameEN: String(s.supp_name_en ?? ""),
      nameKR: String(s.supp_name_kr ?? ""),
      active: s.active !== false,
      sortOrder: Number(s.sort_order) || 0,
    })),
    items: (itemsRes.data || []).map((i) => ({
      code: String(i.item_code),
      nameTH: String(i.item_name_th || ""),
      nameEN: String(i.item_name_en || ""),
      nameKR: String(i.item_name_kr || ""),
      unit: String(i.main_unit || ""),
      subUnit: String(i.sub_unit || ""),
      convertRate: parseFloat(String(i.convert_rate)) || 1,
      mainUnitCode: i.main_unit_code ? String(i.main_unit_code) : undefined,
      subUnitCode: i.sub_unit_code ? String(i.sub_unit_code) : undefined,
      categoryCode: isItemCategoryCode(String(i.category_code || ""))
        ? (String(i.category_code) as ItemCategoryCode)
        : DEFAULT_ITEM_CATEGORY,
    })),
    itemCategories: categories,
    mapping: (mapRes.data || []).map((m) => {
      const item = (itemsRes.data || []).find((i) => i.item_code === m.item_code);
      const mainCode = m.main_unit_code || item?.main_unit_code;
      const subCode = m.sub_unit_code || item?.sub_unit_code;
      const mainFallback = String(item?.main_unit || "");
      const subFallback = String(item?.sub_unit || "");
      const convert =
        m.convert_rate != null
          ? parseFloat(String(m.convert_rate)) || 1
          : parseFloat(String(item?.convert_rate)) || 1;
      const standard =
        m.standard_unit_price != null
          ? parseFloat(String(m.standard_unit_price)) || 0
          : parseFloat(String(m.unit_price)) || 0;
      return {
        suppCode: String(m.supp_code),
        itemCode: String(m.item_code),
        unitPrice: standard,
        standardUnitPrice: standard,
        lastPurchaseUnitPrice:
          m.last_purchase_unit_price != null
            ? parseFloat(String(m.last_purchase_unit_price)) || 0
            : undefined,
        mainUnitCode: mainCode ? String(mainCode) : undefined,
        subUnitCode: subCode ? String(subCode) : undefined,
        mainUnit: unitLabel(mainCode, mainFallback),
        subUnit: unitLabel(subCode, subFallback),
        convertRate: convert,
      };
    }),
    purchaseUnits: (puRes.data || []).map((p) => {
      const mainCode = String(p.main_unit_code || "");
      const subCode = String(p.sub_unit_code || "");
      return {
        suppCode: String(p.supp_code),
        itemCode: String(p.item_code),
        mainUnitCode: mainCode,
        subUnitCode: subCode,
        mainUnit: unitLabel(mainCode, mainCode),
        subUnit: unitLabel(subCode, subCode),
        convertRate: parseFloat(String(p.convert_rate)) || 1,
        standardUnitPrice: parseFloat(String(p.standard_unit_price)) || 0,
        isDefault: p.is_default === true,
        sortOrder: Number(p.sort_order) || 0,
        active: p.active !== false,
      } satisfies ItemPurchaseUnit;
    }),
    itemPurchaseStandards: (ipuRes.data || []).map((p) => {
      const mainCode = String(p.main_unit_code || "");
      const subCode = String(p.sub_unit_code || "");
      return {
        itemCode: String(p.item_code),
        mainUnitCode: mainCode,
        subUnitCode: subCode,
        mainUnit: unitLabel(mainCode, mainCode),
        subUnit: unitLabel(subCode, subCode),
        convertRate: parseFloat(String(p.convert_rate)) || 1,
        isDefault: p.is_default === true,
        sortOrder: Number(p.sort_order) || 0,
        active: p.active !== false,
      } satisfies ItemStandardPurchaseUnit;
    }),
    units,
  };
}

export async function saveItemPurchaseStandards(
  itemCode: string,
  rows: Array<{
    mainUnitCode: string;
    subUnitCode: string;
    convertRate: number;
    isDefault: boolean;
    sortOrder: number;
  }>
) {
  try {
    return await saveItemPurchaseStandardsInner(itemCode, rows);
  } catch (e) {
    return { ok: false, message: formatPostgresError(e) };
  }
}

/** สร้างแถวมาตรฐานเริ่มต้นถ้ายังไม่มี (สินค้าที่สร้างจาก intake / เมนูสินค้าแบบเก่า) */
async function ensureDefaultItemPurchaseStandard(
  supabase: ReturnType<typeof createAdminClient>,
  itemCode: string,
  mainUnitCode: string,
  subUnitCode: string,
  convertRate: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const code = String(itemCode || "").trim();
  if (!code || !mainUnitCode || !subUnitCode) return { ok: true };

  const { data: existing, error: selErr } = await supabase
    .from("item_purchase_units")
    .select("main_unit_code")
    .eq("item_code", code)
    .limit(1);
  if (selErr) {
    if (isMissingRelationError(selErr)) return { ok: true };
    return { ok: false, message: formatPostgresError(selErr) };
  }
  if (existing?.length) return { ok: true };

  const unitsResolved = await resolveMasterUnits(supabase, mainUnitCode, subUnitCode);
  if (!unitsResolved.ok) return unitsResolved;

  const { error } = await supabase.from("item_purchase_units").insert({
    item_code: code,
    main_unit_code: unitsResolved.mainUnitCode,
    sub_unit_code: unitsResolved.subUnitCode,
    convert_rate: convertRate > 0 ? convertRate : 1,
    is_default: true,
    sort_order: 0,
    active: true,
    updated_at: bangkokNow(),
  });
  if (error) {
    if (isMissingRelationError(error)) return { ok: true };
    return { ok: false, message: formatPostgresError(error) };
  }
  return { ok: true };
}

async function saveItemPurchaseStandardsInner(
  itemCode: string,
  rows: Array<{
    mainUnitCode: string;
    subUnitCode: string;
    convertRate: number;
    isDefault: boolean;
    sortOrder: number;
  }>
) {
  const code = String(itemCode || "").trim();
  if (!code) return { ok: false, message: "❌ ไม่พบรหัสสินค้า" };
  if (!rows.length) {
    return { ok: false, message: "❌ กำหนดอย่างน้อย 1 หน่วยซื้อเข้ามาตรฐาน" };
  }

  const supabase = createAdminClient();
  const normalized = rows.map((r, i) => ({
    mainUnitCode: String(r.mainUnitCode || "").trim(),
    subUnitCode: String(r.subUnitCode || "").trim(),
    convertRate: parseFloat(String(r.convertRate)) || 1,
    isDefault: r.isDefault,
    sortOrder: i,
  }));

  for (const r of normalized) {
    if (!r.mainUnitCode || !r.subUnitCode) {
      return { ok: false, message: "❌ กรุณาเลือกหน่วยซื้อเข้าและหน่วยย่อยให้ครบทุกแถว" };
    }
    if (r.convertRate <= 0) {
      return { ok: false, message: "❌ อัตราแปลงหน่วยต้องมากกว่า 0" };
    }
  }

  const mainCodes = normalized.map((r) => r.mainUnitCode);
  if (new Set(mainCodes).size !== mainCodes.length) {
    return {
      ok: false,
      message: "❌ หน่วยซื้อเข้าหลักซ้ำกัน — แต่ละแถวต้องใช้หน่วยหลักคนละตัว",
    };
  }

  const defIdx = normalized.findIndex((r) => r.isDefault);
  const pick = defIdx >= 0 ? defIdx : 0;
  const withDefault = normalized.map((r, i) => ({ ...r, isDefault: i === pick }));

  for (const r of withDefault) {
    const unitsResolved = await resolveMasterUnits(supabase, r.mainUnitCode, r.subUnitCode);
    if (!unitsResolved.ok) return unitsResolved;
  }

  const now = bangkokNow();
  const { error: delErr } = await supabase.from("item_purchase_units").delete().eq("item_code", code);
  if (delErr) {
    return { ok: false, message: formatPostgresError(delErr) };
  }

  for (const r of withDefault) {
    const { error } = await supabase.from("item_purchase_units").insert({
      item_code: code,
      main_unit_code: r.mainUnitCode,
      sub_unit_code: r.subUnitCode,
      convert_rate: r.convertRate,
      is_default: r.isDefault,
      sort_order: r.sortOrder,
      active: true,
      updated_at: now,
    });
    if (error) {
      return { ok: false, message: formatPostgresError(error) };
    }
  }

  const def = withDefault.find((r) => r.isDefault) ?? withDefault[0];
  const defUnits = await resolveMasterUnits(supabase, def.mainUnitCode, def.subUnitCode);
  if (!defUnits.ok) return defUnits;

  const { error: itemErr } = await supabase
    .from("items")
    .update({
      main_unit_code: def.mainUnitCode,
      sub_unit_code: def.subUnitCode,
      main_unit: defUnits.mainUnit,
      sub_unit: defUnits.subUnit,
      convert_rate: def.convertRate,
    })
    .eq("item_code", code);
  if (itemErr) {
    return { ok: false, message: formatPostgresError(itemErr) };
  }

  return { ok: true, message: "✅ บันทึกหน่วยซื้อเข้ามาตรฐานแล้ว" };
}

export async function getTransactions(filters?: {
  dateFrom?: string;
  dateTo?: string;
  suppCode?: string;
  slipId?: string;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("transactions")
    .select(
      "slip_id, txn_date, supp_code, supp_name, item_code, item_name_th, qty, main_unit, unit_price, total_price, note, saved_at, saved_by_name"
    );

  if (filters?.slipId) query = query.eq("slip_id", filters.slipId);
  if (filters?.suppCode) query = query.eq("supp_code", filters.suppCode);
  if (filters?.dateFrom) query = query.gte("txn_date", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("txn_date", filters.dateTo);

  const { data, error } = await query
    .order("txn_date", { ascending: false })
    .order("saved_at", { ascending: false });

  if (error) throw error;

  return {
    success: true,
    rows: (data || []).map((r) => ({
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
    })),
  };
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

export async function hasTransactionsForDateSupp(date: string, suppCode: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, txn_date")
    .eq("supp_code", suppCode);
  if (error) throw error;
  return (data || []).some((r) => toDateStr(r.txn_date) === date);
}

export async function getIntakeSlipMeta(date: string, suppCode: string) {
  const { rows } = await getTransactions({ dateFrom: date, dateTo: date, suppCode });
  return slipMetaFromRows(rows);
}

export { listIntakeSlips, getIntakeSlipById, getTransactionRowsForSlip, deleteIntakeSlipById, getIntakeSlipMetaById } from "@/lib/services/intake-slips";

/** บันทึกใบรับของ — slipId ว่าง = ใบใหม่; มี slipId = แก้ไขใบเดิม */
export async function saveIntakeSlip(
  transactions: TransactionInput[],
  audit?: SaveAudit,
  options?: { slipId?: string | null; slipNote?: string }
) {
  const { saveIntakeSlipRecord } = await import("@/lib/services/intake-slips");
  const result = await saveIntakeSlipRecord({
    slipId: options?.slipId,
    transactions,
    slipNote: options?.slipNote,
    audit,
  });
  if (result.ok) {
    await updateMappingPrices(transactions, audit);
  }
  return result;
}

export async function saveMultipleTransactions(
  transactions: TransactionInput[],
  audit?: SaveAudit
) {
  if (!transactions?.length) {
    return { ok: false, message: "❌ ไม่มีรายการส่งมา" };
  }

  const supabase = createAdminClient();
  let lastNo = await getLastTransactionNo(supabase);
  const savedAt = bangkokNow();

  const rows = transactions.map((t) => {
    lastNo += 1;
    return buildTransactionRow(t, lastNo, savedAt, audit);
  });

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw error;

  await updateMappingPrices(transactions, audit);

  const first = rows[0].no;
  const last = rows[rows.length - 1].no;
  return {
    ok: true,
    message: `✅ บันทึกสำเร็จ ${rows.length} รายการ (no.${first}–${last})`,
  };
}

async function updateMappingPrices(
  transactions: TransactionInput[],
  audit?: SaveAudit
) {
  const supabase = createAdminClient();
  const now = bangkokNow();

  for (const t of transactions) {
    const price = calcMappingPrice(t);
    if (price === null) continue;

    const { data: cur } = await supabase
      .from("supplier_item_mapping")
      .select("*")
      .eq("supp_code", t.suppCode)
      .eq("item_code", t.itemCode)
      .maybeSingle();

    const prevLast = cur?.last_purchase_unit_price
      ? parseFloat(String(cur.last_purchase_unit_price))
      : null;

    if (prevLast !== price) {
      await insertMappingPriceHistory({
        suppCode: t.suppCode,
        itemCode: t.itemCode,
        unitPrice: price,
        priceKind: "last_purchase",
        source: "intake",
        recordedBy: audit?.displayName,
      });
    }

    await supabase
      .from("supplier_item_mapping")
      .update({
        last_purchase_unit_price: price,
        last_purchase_at: now,
        updated_at: now,
        updated_by: audit?.displayName || null,
      })
      .eq("supp_code", t.suppCode)
      .eq("item_code", t.itemCode);
  }
}

export async function deleteTransactionsByDateSupp(date: string, suppCode: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, txn_date, supp_code")
    .eq("supp_code", suppCode);

  if (error) throw error;

  const ids = (data || [])
    .filter((r) => toDateStr(r.txn_date) === date)
    .map((r) => r.id);

  if (ids.length === 0) return { success: true, deleted: 0 };

  const { error: delError } = await supabase.from("transactions").delete().in("id", ids);
  if (delError) throw delError;

  return { success: true, deleted: ids.length };
}

export async function replaceTransactionsByDateSupp(
  date: string,
  suppCode: string,
  transactions: TransactionInput[],
  audit?: SaveAudit
) {
  const del = await deleteTransactionsByDateSupp(date, suppCode);
  if (!del.success) return del;
  const save = await saveMultipleTransactions(transactions, audit);
  return { success: save.ok, message: save.message, deleted: del.deleted };
}

export async function generateSuppCode(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string> {
  const { data } = await supabase.from("suppliers").select("supp_code");
  const codes = (data || [])
    .map((r) => String(r.supp_code))
    .filter((c) => /^s\d+$/i.test(c));
  const nums = codes.map((c) => parseInt(c.replace(/^s/i, ""), 10)).filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return "s" + String(next).padStart(4, "0");
}

function normName(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function findSupplierByName(
  names: { nameTH: string; nameEN?: string; nameKR?: string },
  excludeSuppCode?: string
) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("suppliers").select("*");
  const th = normName(names.nameTH);
  const en = normName(names.nameEN || "");
  const kr = normName(names.nameKR || "");
  const skip = excludeSuppCode ? String(excludeSuppCode).toUpperCase() : "";

  return (existing || []).find((s) => {
    if (skip && String(s.supp_code).toUpperCase() === skip) return false;
    if (th && normName(s.supp_name) === th) return true;
    if (en && normName(s.supp_name_en) === en) return true;
    if (kr && normName(s.supp_name_kr) === kr) return true;
    return false;
  });
}

export async function addSupplier(
  suppCode: string,
  names: { nameTH: string; nameEN?: string; nameKR?: string }
) {
  const supabase = createAdminClient();
  let code = String(suppCode || "").trim().toUpperCase();
  if (!code) code = await generateSuppCode(supabase);

  const nameTH = names.nameTH.trim();
  if (!nameTH) return { ok: false, message: "❌ กรุณากรอกชื่อร้านค้า (ไทย)" };

  const dup = await findSupplierByName(names);
  if (dup) {
    return {
      ok: false,
      message: `❌ มีร้านชื่อ "${dup.supp_name}" อยู่แล้ว — ตรวจรายการด้านล่าง`,
    };
  }

  const { data: existing } = await supabase.from("suppliers").select("supp_code");
  if ((existing || []).some((s) => String(s.supp_code).toUpperCase() === code)) {
    code = await generateSuppCode(supabase);
  }

  const { data: maxOrderRow } = await supabase
    .from("suppliers")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (Number(maxOrderRow?.sort_order) || 0) + 10;

  const { error } = await supabase.from("suppliers").insert({
    supp_code: code,
    supp_name: nameTH,
    supp_name_en: (names.nameEN || "").trim(),
    supp_name_kr: (names.nameKR || "").trim(),
    active: true,
    sort_order: nextSortOrder,
  });
  if (error) throw error;
  return { ok: true, message: `✅ เพิ่มร้านค้า "${nameTH}" สำเร็จ (${code})` };
}

async function renameSupplierCode(
  supabase: ReturnType<typeof createAdminClient>,
  oldCode: string,
  newCode: string
) {
  const tables = [
    "transactions",
    "supplier_item_mapping",
    "mapping_price_history",
    "supplier_item_mapping_versions",
    "unit_pair_hints",
  ] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).update({ supp_code: newCode }).eq("supp_code", oldCode);
    if (error) throw error;
  }
}

export async function updateSupplier(
  currentCode: string,
  data: {
    suppCode?: string;
    nameTH: string;
    nameEN?: string;
    nameKR?: string;
    active?: boolean;
  }
) {
  const supabase = createAdminClient();
  const oldCode = String(currentCode).trim();
  const newCode = String(data.suppCode || oldCode).trim().toUpperCase();
  const nameTH = data.nameTH.trim();
  if (!nameTH) return { ok: false, message: "❌ กรุณากรอกชื่อร้านค้า (ไทย)" };

  const { data: row } = await supabase
    .from("suppliers")
    .select("*")
    .eq("supp_code", oldCode)
    .maybeSingle();
  if (!row) return { ok: false, message: "❌ ไม่พบร้านค้านี้" };

  const dup = await findSupplierByName(
    { nameTH, nameEN: data.nameEN, nameKR: data.nameKR },
    oldCode
  );
  if (dup) {
    return {
      ok: false,
      message: `❌ ชื่อซ้ำกับร้าน "${dup.supp_name}" (${dup.supp_code})`,
    };
  }

  const codeChanging = newCode !== oldCode.toUpperCase();
  if (codeChanging) {
    const { data: taken } = await supabase
      .from("suppliers")
      .select("supp_code")
      .eq("supp_code", newCode)
      .maybeSingle();
    if (taken) {
      return { ok: false, message: `❌ รหัส "${newCode}" ถูกใช้แล้ว` };
    }
    await renameSupplierCode(supabase, oldCode, newCode);
  }

  const patch: Record<string, unknown> = {
    supp_name: nameTH,
    supp_name_en: (data.nameEN || "").trim(),
    supp_name_kr: (data.nameKR || "").trim(),
  };
  if (data.active !== undefined) patch.active = data.active;
  if (codeChanging) patch.supp_code = newCode;

  const { error } = await supabase.from("suppliers").update(patch).eq("supp_code", oldCode);
  if (error) throw error;

  return {
    ok: true,
    message: `✅ บันทึกร้าน "${nameTH}" สำเร็จ${codeChanging ? ` (${newCode})` : ""}`,
    code: codeChanging ? newCode : oldCode,
  };
}

export async function deleteSupplier(currentCode: string) {
  const supabase = createAdminClient();
  const code = String(currentCode).trim();
  if (!code) return { ok: false, message: "❌ ไม่พบร้านค้า" };

  const { data: row } = await supabase
    .from("suppliers")
    .select("supp_code, supp_name")
    .eq("supp_code", code)
    .maybeSingle();
  if (!row) return { ok: false, message: "❌ ไม่พบร้านค้านี้" };

  const { count: txnCount, error: txnErr } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("supp_code", code);
  if (txnErr) throw txnErr;
  if ((txnCount ?? 0) > 0) {
    return {
      ok: false,
      message: `❌ ไม่สามารถลบได้ — มีประวัติรับของ ${txnCount} รายการ ให้ปิดใช้งานแทน`,
    };
  }

  const { error } = await supabase.from("suppliers").delete().eq("supp_code", code);
  if (error) throw error;

  const name = String(row.supp_name || code);
  return { ok: true, message: `✅ ลบร้าน "${name}" (${code}) แล้ว` };
}

export async function reorderSuppliers(codes: string[]) {
  const supabase = createAdminClient();
  const normalized = codes.map((c) => String(c || "").trim().toUpperCase()).filter(Boolean);
  if (!normalized.length) {
    return { ok: false, message: "❌ ไม่มีรายการลำดับ" };
  }

  const { data: rows, error: loadErr } = await supabase.from("suppliers").select("supp_code, active");
  if (loadErr) throw loadErr;

  const activeCodes = new Set(
    (rows || []).filter((r) => r.active !== false).map((r) => String(r.supp_code).toUpperCase())
  );
  const unknown = normalized.filter((c) => !activeCodes.has(c));
  if (unknown.length) {
    return { ok: false, message: `❌ ไม่พบร้านที่เปิดใช้งาน: ${unknown.join(", ")}` };
  }

  const updates = normalized.map((code, index) =>
    supabase
      .from("suppliers")
      .update({ sort_order: (index + 1) * 10 })
      .eq("supp_code", code)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  return { ok: true, message: "✅ บันทึกลำดับร้านค้าใน dropdown รับของแล้ว" };
}

async function renameItemCode(
  supabase: ReturnType<typeof createAdminClient>,
  oldCode: string,
  newCode: string
) {
  const tables = [
    "transactions",
    "supplier_item_mapping",
    "supplier_item_purchase_units",
    "item_purchase_units",
    "mapping_price_history",
    "item_versions",
    "supplier_item_mapping_versions",
    "unit_pair_hints",
  ] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).update({ item_code: newCode }).eq("item_code", oldCode);
    if (error) throw error;
  }
}

async function resolveMasterUnits(
  supabase: ReturnType<typeof createAdminClient>,
  mainUnitCode: string,
  subUnitCode: string
) {
  const mainCode = String(mainUnitCode || "").trim();
  const subCode = String(subUnitCode || "").trim();
  if (!mainCode || !subCode) {
    return { ok: false as const, message: "❌ กรุณาเลือกหน่วยหลักและหน่วยย่อยจากรายการหน่วยสินค้า" };
  }

  const { data: rows, error } = await supabase
    .from("units")
    .select("*")
    .in("unit_code", [mainCode, subCode]);
  if (error) {
    return { ok: false as const, message: formatPostgresError(error) };
  }

  const mainRow = (rows || []).find((u) => String(u.unit_code) === mainCode);
  const subRow = (rows || []).find((u) => String(u.unit_code) === subCode);
  if (!mainRow || mainRow.active === false) {
    return { ok: false as const, message: "❌ หน่วยหลักไม่ถูกต้อง — เลือกจากหน่วยสินค้าในระบบ" };
  }
  if (!subRow || subRow.active === false) {
    return { ok: false as const, message: "❌ หน่วยย่อยไม่ถูกต้อง — เลือกจากหน่วยสินค้าในระบบ" };
  }

  const mainU = unitPrimaryName({
    nameTH: String(mainRow.unit_name_th ?? mainRow.display_name ?? ""),
    nameEN: String(mainRow.unit_name_en ?? ""),
    nameKR: String(mainRow.unit_name_kr ?? ""),
  });
  const subU = unitPrimaryName({
    nameTH: String(subRow.unit_name_th ?? subRow.display_name ?? ""),
    nameEN: String(subRow.unit_name_en ?? ""),
    nameKR: String(subRow.unit_name_kr ?? ""),
  });

  return {
    ok: true as const,
    mainUnitCode: mainCode,
    subUnitCode: subCode,
    mainUnit: mainU,
    subUnit: subU,
  };
}

export async function saveItemMaster(data: {
  currentItemCode?: string;
  itemCode?: string;
  itemNameTH: string;
  itemNameEN?: string;
  itemNameKR?: string;
  mainUnitCode: string;
  subUnitCode: string;
  convertRate?: number | string;
  categoryCode?: string;
  changedBy?: string;
}) {
  const supabase = createAdminClient();
  const nameTH = data.itemNameTH.trim();
  if (!nameTH) return { ok: false, message: "❌ กรุณากรอกชื่อสินค้า (ไทย)" };

  const categoryCode = isItemCategoryCode(String(data.categoryCode || ""))
    ? (String(data.categoryCode) as ItemCategoryCode)
    : DEFAULT_ITEM_CATEGORY;

  const unitsResolved = await resolveMasterUnits(supabase, data.mainUnitCode, data.subUnitCode);
  if (!unitsResolved.ok) return unitsResolved;

  const convertRate = parseFloat(String(data.convertRate)) || 1;
  if (convertRate <= 0) return { ok: false, message: "❌ อัตราแปลงหน่วยต้องมากกว่า 0" };

  const { data: items } = await supabase.from("items").select("*");
  const currentCode = data.currentItemCode ? String(data.currentItemCode).trim() : "";
  const targetCode = String(data.itemCode || currentCode || "")
    .trim()
    .toUpperCase();

  const dup = (items || []).find(
    (i) =>
      normName(i.item_name_th) === normName(nameTH) &&
      String(i.item_code) !== currentCode
  );
  if (dup) {
    return {
      ok: false,
      message: `❌ ชื่อซ้ำกับสินค้า "${dup.item_name_th}" (${dup.item_code})`,
    };
  }

  const hasCategoryCol = await itemsTableHasCategoryCode(supabase);
  const itemPatch = {
    item_name_th: nameTH,
    item_name_en: (data.itemNameEN || "").trim(),
    item_name_kr: (data.itemNameKR || "").trim(),
    main_unit: unitsResolved.mainUnit,
    sub_unit: unitsResolved.subUnit,
    main_unit_code: unitsResolved.mainUnitCode,
    sub_unit_code: unitsResolved.subUnitCode,
    convert_rate: convertRate,
    ...(hasCategoryCol ? { category_code: categoryCode } : {}),
  };

  if (currentCode) {
    const { data: row } = await supabase
      .from("items")
      .select("*")
      .eq("item_code", currentCode)
      .maybeSingle();
    if (!row) return { ok: false, message: "❌ ไม่พบสินค้านี้" };

    const newCode = targetCode || currentCode;
    const codeChanging = newCode !== currentCode.toUpperCase();
    if (codeChanging) {
      if (!newCode) return { ok: false, message: "❌ กรุณาระบุรหัสสินค้า" };
      const { data: taken } = await supabase
        .from("items")
        .select("item_code")
        .eq("item_code", newCode)
        .maybeSingle();
      if (taken) return { ok: false, message: `❌ รหัส "${newCode}" ถูกใช้แล้ว` };
      try {
        await renameItemCode(supabase, currentCode, newCode);
      } catch (e) {
        return { ok: false, message: formatPostgresError(e) };
      }
    }

    const updateKey = codeChanging ? currentCode : currentCode;
    const patch = { ...itemPatch, ...(codeChanging ? { item_code: newCode } : {}) };
    const { error } = await supabase.from("items").update(patch).eq("item_code", updateKey);
    if (error) {
      return { ok: false, message: formatPostgresError(error) };
    }

    try {
      await recordItemVersion(
        newCode,
        {
          itemNameTH: nameTH,
          itemNameEN: data.itemNameEN || "",
          itemNameKR: data.itemNameKR || "",
          mainUnit: unitsResolved.mainUnit,
          subUnit: unitsResolved.subUnit,
          mainUnitCode: unitsResolved.mainUnitCode,
          subUnitCode: unitsResolved.subUnitCode,
          convertRate,
        },
        { displayName: data.changedBy || "system", reason: "update" }
      );
    } catch (e) {
      return { ok: false, message: formatPostgresError(e) };
    }

    const stdEnsure = await ensureDefaultItemPurchaseStandard(
      supabase,
      newCode,
      unitsResolved.mainUnitCode,
      unitsResolved.subUnitCode,
      convertRate
    );
    if (!stdEnsure.ok) return stdEnsure;

    return {
      ok: true,
      message: `✅ บันทึกสินค้า "${nameTH}" สำเร็จ (${newCode})`,
      itemCode: newCode,
    };
  }

  let itemCode = targetCode;
  if (!itemCode) itemCode = await generateItemCode(supabase);
  if ((items || []).some((i) => String(i.item_code).toUpperCase() === itemCode)) {
    itemCode = await generateItemCode(supabase);
  }

  const { error } = await supabase.from("items").insert({
    item_code: itemCode,
    ...itemPatch,
  });
  if (error) {
    return { ok: false, message: formatPostgresError(error) };
  }

  try {
    await recordItemVersion(
      itemCode,
      {
        itemNameTH: nameTH,
        itemNameEN: data.itemNameEN || "",
        itemNameKR: data.itemNameKR || "",
        mainUnit: unitsResolved.mainUnit,
        subUnit: unitsResolved.subUnit,
        mainUnitCode: unitsResolved.mainUnitCode,
        subUnitCode: unitsResolved.subUnitCode,
        convertRate,
      },
      { displayName: data.changedBy || "system", reason: "create" }
    );
  } catch (e) {
    return { ok: false, message: formatPostgresError(e) };
  }

  const stdEnsure = await ensureDefaultItemPurchaseStandard(
    supabase,
    itemCode,
    unitsResolved.mainUnitCode,
    unitsResolved.subUnitCode,
    convertRate
  );
  if (!stdEnsure.ok) return stdEnsure;

  return { ok: true, message: `✅ เพิ่มสินค้า "${nameTH}" สำเร็จ (${itemCode})`, itemCode };
}

export async function deleteItem(itemCode: string) {
  const supabase = createAdminClient();
  const code = String(itemCode).trim();
  if (!code) return { ok: false, message: "❌ ไม่พบสินค้า" };

  const { data: row } = await supabase
    .from("items")
    .select("item_code, item_name_th")
    .eq("item_code", code)
    .maybeSingle();
  if (!row) return { ok: false, message: "❌ ไม่พบสินค้านี้" };

  const { count: txnCount, error: txnErr } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("item_code", code);
  if (txnErr) throw txnErr;
  if ((txnCount ?? 0) > 0) {
    return {
      ok: false,
      message: `❌ ไม่สามารถลบได้ — มีประวัติรับของ ${txnCount} รายการ`,
    };
  }

  const { error } = await supabase.from("items").delete().eq("item_code", code);
  if (error) throw error;

  const name = String(row.item_name_th || code);
  return { ok: true, message: `✅ ลบสินค้า "${name}" (${code}) แล้ว` };
}

export async function addNewItemToSupplier(data: {
  suppCode: string;
  itemCode?: string;
  itemNameTH: string;
  itemNameEN?: string;
  itemNameKR?: string;
  mainUnit?: string;
  subUnit?: string;
  mainUnitCode?: string;
  subUnitCode?: string;
  convertRate?: number | string;
  unitPrice?: number | string;
  changedBy?: string;
}) {
  const supabase = createAdminClient();
  const { data: items } = await supabase.from("items").select("*");

  const mainResolved = data.mainUnitCode
    ? { code: data.mainUnitCode, displayName: data.mainUnit || data.mainUnitCode }
    : await resolveUnitCode(supabase, data.mainUnit || "");
  const subResolved = data.subUnitCode
    ? { code: data.subUnitCode, displayName: data.subUnit || data.subUnitCode }
    : await resolveUnitCode(supabase, data.subUnit || "");

  if (!mainResolved || !subResolved) {
    return { ok: false, message: "❌ กรุณาเลือกหน่วยซื้อเข้าและหน่วยย่อย" };
  }

  const convertRate = parseFloat(String(data.convertRate)) || 1;
  const standardPrice = parseFloat(String(data.unitPrice)) || 0;

  let itemCode = String(data.itemCode || "").trim();
  const dup = (items || []).find(
    (i) =>
      String(i.item_name_th).trim().toLowerCase() ===
      String(data.itemNameTH).trim().toLowerCase()
  );

  if (dup) {
    itemCode = String(dup.item_code);
  } else {
    if (!itemCode) itemCode = await generateItemCode(supabase);
    const hasCategoryCol = await itemsTableHasCategoryCode(supabase);
    const { error } = await supabase.from("items").insert({
      item_code: itemCode,
      item_name_th: data.itemNameTH || "",
      item_name_en: data.itemNameEN || "",
      item_name_kr: data.itemNameKR || "",
      main_unit: mainResolved.displayName,
      sub_unit: subResolved.displayName,
      main_unit_code: mainResolved.code,
      sub_unit_code: subResolved.code,
      convert_rate: convertRate,
      ...(hasCategoryCol ? { category_code: DEFAULT_ITEM_CATEGORY } : {}),
    });
    if (error) throw error;
    await recordItemVersion(
      itemCode,
      {
        itemNameTH: data.itemNameTH || "",
        itemNameEN: data.itemNameEN || "",
        itemNameKR: data.itemNameKR || "",
        mainUnit: mainResolved.displayName,
        subUnit: subResolved.displayName,
        mainUnitCode: mainResolved.code,
        subUnitCode: subResolved.code,
        convertRate,
      },
      { displayName: data.changedBy || "system", reason: "create" }
    );
  }

  const { data: itemRow } = await supabase
    .from("items")
    .select("main_unit_code, sub_unit_code, convert_rate")
    .eq("item_code", itemCode)
    .maybeSingle();
  const stdMain = itemRow?.main_unit_code
    ? String(itemRow.main_unit_code)
    : mainResolved.code;
  const stdSub = itemRow?.sub_unit_code ? String(itemRow.sub_unit_code) : subResolved.code;
  const stdRate =
    itemRow?.convert_rate != null
      ? parseFloat(String(itemRow.convert_rate)) || convertRate
      : convertRate;
  const stdEnsure = await ensureDefaultItemPurchaseStandard(
    supabase,
    itemCode,
    stdMain,
    stdSub,
    stdRate
  );
  if (!stdEnsure.ok) return stdEnsure;

  const { data: maps } = await supabase
    .from("supplier_item_mapping")
    .select("*")
    .eq("supp_code", data.suppCode)
    .eq("item_code", itemCode);

  if (maps?.length) {
    return { ok: false, message: `⚠️ "${data.itemNameTH}" ผูกกับร้านนี้อยู่แล้ว` };
  }

  const { error: mapErr } = await supabase.from("supplier_item_mapping").insert({
    supp_code: data.suppCode,
    item_code: itemCode,
    unit_price: standardPrice,
    standard_unit_price: standardPrice,
    main_unit_code: mainResolved.code,
    sub_unit_code: subResolved.code,
    convert_rate: convertRate,
    active: true,
    updated_at: bangkokNow(),
    updated_by: data.changedBy || null,
  });
  if (mapErr) throw mapErr;

  if (standardPrice > 0) {
    await insertMappingPriceHistory({
      suppCode: data.suppCode,
      itemCode,
      unitPrice: standardPrice,
      priceKind: "standard",
      source: "manual",
      recordedBy: data.changedBy,
    });
  }

  await recordMappingVersion(
    data.suppCode,
    itemCode,
    {
      mainUnit: mainResolved.displayName,
      subUnit: subResolved.displayName,
      mainUnitCode: mainResolved.code,
      subUnitCode: subResolved.code,
      convertRate,
      standardUnitPrice: standardPrice,
    },
    { displayName: data.changedBy || "system", reason: "link" }
  );

  return {
    ok: true,
    message: `✅ เพิ่มสินค้า "${data.itemNameTH}" และผูกกับร้านค้าสำเร็จ (${itemCode})`,
  };
}

export interface ShopPurchaseUnitConfig {
  mainUnitCode: string;
  subUnitCode: string;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  standardUnitPrice: number;
  isDefault: boolean;
}

export interface ShopProductConfig {
  suppCode: string;
  purchaseUnits: ShopPurchaseUnitConfig[];
}

export interface ShopMappingUpsert {
  suppCode: string;
  mainUnitCode: string;
  subUnitCode: string;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  standardUnitPrice: number;
}

function ensureOneDefaultPurchaseUnit(units: ShopPurchaseUnitConfig[]): ShopPurchaseUnitConfig[] {
  if (!units.length) return units;
  const defIdx = units.findIndex((u) => u.isDefault);
  const pick = defIdx >= 0 ? defIdx : 0;
  return units.map((u, i) => ({ ...u, isDefault: i === pick }));
}

async function syncShopPurchaseUnits(
  supabase: ReturnType<typeof createAdminClient>,
  itemCode: string,
  shop: ShopProductConfig,
  changedBy?: string
) {
  const units = ensureOneDefaultPurchaseUnit(shop.purchaseUnits);
  const now = bangkokNow();

  await supabase
    .from("supplier_item_purchase_units")
    .delete()
    .eq("supp_code", shop.suppCode)
    .eq("item_code", itemCode);

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const { error } = await supabase.from("supplier_item_purchase_units").insert({
      supp_code: shop.suppCode,
      item_code: itemCode,
      main_unit_code: u.mainUnitCode,
      sub_unit_code: u.subUnitCode,
      convert_rate: parseFloat(String(u.convertRate)) || 1,
      standard_unit_price: parseFloat(String(u.standardUnitPrice)) || 0,
      is_default: u.isDefault,
      sort_order: i,
      active: true,
      updated_at: now,
    });
    if (error) throw error;
  }

  const def = units.find((u) => u.isDefault) ?? units[0];
  await upsertShopProductMapping(
    supabase,
    itemCode,
    {
      suppCode: shop.suppCode,
      mainUnitCode: def.mainUnitCode,
      subUnitCode: def.subUnitCode,
      mainUnit: def.mainUnit,
      subUnit: def.subUnit,
      convertRate: def.convertRate,
      standardUnitPrice: def.standardUnitPrice,
    },
    changedBy
  );
}

async function upsertShopProductMapping(
  supabase: ReturnType<typeof createAdminClient>,
  itemCode: string,
  cfg: ShopMappingUpsert,
  changedBy?: string
) {
  const convertRate = parseFloat(String(cfg.convertRate)) || 1;
  const standardPrice = parseFloat(String(cfg.standardUnitPrice)) || 0;
  const now = bangkokNow();

  const { data: existing } = await supabase
    .from("supplier_item_mapping")
    .select("*")
    .eq("supp_code", cfg.suppCode)
    .eq("item_code", itemCode)
    .maybeSingle();

  if (existing) {
    const prev = parseFloat(String(existing.standard_unit_price ?? existing.unit_price)) || 0;
    const { error } = await supabase
      .from("supplier_item_mapping")
      .update({
        main_unit_code: cfg.mainUnitCode,
        sub_unit_code: cfg.subUnitCode,
        convert_rate: convertRate,
        unit_price: standardPrice,
        standard_unit_price: standardPrice,
        active: true,
        updated_at: now,
        updated_by: changedBy || null,
      })
      .eq("supp_code", cfg.suppCode)
      .eq("item_code", itemCode);
    if (error) throw error;

    if (prev !== standardPrice && standardPrice > 0) {
      await insertMappingPriceHistory({
        suppCode: cfg.suppCode,
        itemCode,
        unitPrice: standardPrice,
        priceKind: "standard",
        source: "manual",
        recordedBy: changedBy,
      });
    }

    await recordMappingVersion(
      cfg.suppCode,
      itemCode,
      {
        mainUnit: cfg.mainUnit,
        subUnit: cfg.subUnit,
        mainUnitCode: cfg.mainUnitCode,
        subUnitCode: cfg.subUnitCode,
        convertRate,
        standardUnitPrice: standardPrice,
        lastPurchaseUnitPrice: existing.last_purchase_unit_price
          ? parseFloat(String(existing.last_purchase_unit_price))
          : null,
      },
      { displayName: changedBy || "system", reason: "update" }
    );
    return;
  }

  const { error: insErr } = await supabase.from("supplier_item_mapping").insert({
    supp_code: cfg.suppCode,
    item_code: itemCode,
    unit_price: standardPrice,
    standard_unit_price: standardPrice,
    main_unit_code: cfg.mainUnitCode,
    sub_unit_code: cfg.subUnitCode,
    convert_rate: convertRate,
    active: true,
    updated_at: now,
    updated_by: changedBy || null,
  });
  if (insErr) throw insErr;

  if (standardPrice > 0) {
    await insertMappingPriceHistory({
      suppCode: cfg.suppCode,
      itemCode,
      unitPrice: standardPrice,
      priceKind: "standard",
      source: "manual",
      recordedBy: changedBy,
    });
  }

  await recordMappingVersion(
    cfg.suppCode,
    itemCode,
    {
      mainUnit: cfg.mainUnit,
      subUnit: cfg.subUnit,
      mainUnitCode: cfg.mainUnitCode,
      subUnitCode: cfg.subUnitCode,
      convertRate,
      standardUnitPrice: standardPrice,
    },
    { displayName: changedBy || "system", reason: "link" }
  );
}

export async function saveProductShopMappings(data: {
  itemCode?: string;
  itemNameTH: string;
  itemNameEN?: string;
  itemNameKR?: string;
  shops: ShopProductConfig[];
  changedBy?: string;
}) {
  if (!data.shops.length) {
    return { ok: false, message: "❌ เลือกอย่างน้อย 1 ร้านค้าและตั้งค่าให้ครบ" };
  }

  const supabase = createAdminClient();
  const { data: items } = await supabase.from("items").select("*");

  let itemCode = String(data.itemCode || "").trim();
  const nameKey = normName(data.itemNameTH);
  const dup = (items || []).find((i) => normName(i.item_name_th) === nameKey);

  const firstShop = data.shops[0];
  const firstUnits = ensureOneDefaultPurchaseUnit(firstShop.purchaseUnits);
  const first = firstUnits.find((u) => u.isDefault) ?? firstUnits[0];
  if (!first) {
    return { ok: false, message: "❌ ต้องมีอย่างน้อย 1 หน่วยซื้อเข้าต่อร้าน" };
  }
  if (dup) {
    itemCode = String(dup.item_code);
    await supabase
      .from("items")
      .update({
        item_name_th: data.itemNameTH.trim(),
        item_name_en: (data.itemNameEN || "").trim(),
        item_name_kr: (data.itemNameKR || "").trim(),
        main_unit: first.mainUnit,
        sub_unit: first.subUnit,
        main_unit_code: first.mainUnitCode,
        sub_unit_code: first.subUnitCode,
        convert_rate: first.convertRate,
      })
      .eq("item_code", itemCode);
  } else {
    if (!itemCode) itemCode = await generateItemCode(supabase);
    const hasCategoryCol = await itemsTableHasCategoryCode(supabase);
    const { error } = await supabase.from("items").insert({
      item_code: itemCode,
      item_name_th: data.itemNameTH.trim(),
      item_name_en: (data.itemNameEN || "").trim(),
      item_name_kr: (data.itemNameKR || "").trim(),
      main_unit: first.mainUnit,
      sub_unit: first.subUnit,
      main_unit_code: first.mainUnitCode,
      sub_unit_code: first.subUnitCode,
      convert_rate: first.convertRate,
      ...(hasCategoryCol ? { category_code: DEFAULT_ITEM_CATEGORY } : {}),
    });
    if (error) throw error;
    await recordItemVersion(
      itemCode,
      {
        itemNameTH: data.itemNameTH.trim(),
        itemNameEN: data.itemNameEN || "",
        itemNameKR: data.itemNameKR || "",
        mainUnit: first.mainUnit,
        subUnit: first.subUnit,
        mainUnitCode: first.mainUnitCode,
        subUnitCode: first.subUnitCode,
        convertRate: first.convertRate,
      },
      { displayName: data.changedBy || "system", reason: "create" }
    );
  }

  const shopCodes = new Set(data.shops.map((s) => s.suppCode));
  const { data: curMaps } = await supabase
    .from("supplier_item_mapping")
    .select("supp_code")
    .eq("item_code", itemCode);

  for (const m of curMaps || []) {
    if (!shopCodes.has(String(m.supp_code))) {
      await supabase
        .from("supplier_item_purchase_units")
        .delete()
        .eq("supp_code", m.supp_code)
        .eq("item_code", itemCode);
      await supabase
        .from("supplier_item_mapping")
        .delete()
        .eq("supp_code", m.supp_code)
        .eq("item_code", itemCode);
    }
  }

  for (const shop of data.shops) {
    if (!shop.purchaseUnits?.length) {
      return { ok: false, message: "❌ ต้องมีอย่างน้อย 1 หน่วยซื้อเข้าต่อร้านที่เลือก" };
    }
    for (const u of shop.purchaseUnits) {
      if (!u.mainUnitCode || !u.subUnitCode) {
        return { ok: false, message: "❌ กรุณาเลือกหน่วยให้ครบทุกตัวเลือกซื้อเข้า" };
      }
    }
    await syncShopPurchaseUnits(supabase, itemCode, shop, data.changedBy);
  }

  return {
    ok: true,
    message: `✅ บันทึกสินค้า "${data.itemNameTH}" กับ ${data.shops.length} ร้านค้าสำเร็จ (${itemCode})`,
    itemCode,
  };
}

export async function updateUnitPrice(
  suppCode: string,
  itemCode: string,
  newPrice: number,
  audit?: { displayName: string }
) {
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("supplier_item_mapping")
    .select("*")
    .eq("supp_code", suppCode)
    .eq("item_code", itemCode)
    .maybeSingle();

  if (!before) return { ok: false, message: "❌ ไม่พบข้อมูล mapping" };

  const prev = parseFloat(String(before.standard_unit_price ?? before.unit_price)) || 0;
  const now = bangkokNow();

  const { data, error } = await supabase
    .from("supplier_item_mapping")
    .update({
      unit_price: newPrice,
      standard_unit_price: newPrice,
      updated_at: now,
      updated_by: audit?.displayName || null,
    })
    .eq("supp_code", suppCode)
    .eq("item_code", itemCode)
    .select();

  if (error) throw error;
  if (!data?.length) return { ok: false, message: "❌ ไม่พบข้อมูล mapping" };

  if (prev !== newPrice) {
    await insertMappingPriceHistory({
      suppCode,
      itemCode,
      unitPrice: newPrice,
      priceKind: "standard",
      source: "manual",
      recordedBy: audit?.displayName,
    });

    const { data: units } = await supabase
      .from("units")
      .select("unit_code, display_name, unit_name_th, unit_name_en, unit_name_kr")
      .in("unit_code", [before.main_unit_code, before.sub_unit_code].filter(Boolean));

    const nameMap = new Map(
      (units || []).map((u) => [
        u.unit_code,
        String(u.unit_name_th || u.display_name || ""),
      ])
    );
    const { data: item } = await supabase.from("items").select("*").eq("item_code", itemCode).maybeSingle();

    await recordMappingVersion(
      suppCode,
      itemCode,
      {
        mainUnit: nameMap.get(before.main_unit_code) || item?.main_unit || "",
        subUnit: nameMap.get(before.sub_unit_code) || item?.sub_unit || "",
        mainUnitCode: before.main_unit_code,
        subUnitCode: before.sub_unit_code,
        convertRate: parseFloat(String(before.convert_rate ?? item?.convert_rate)) || 1,
        standardUnitPrice: newPrice,
        lastPurchaseUnitPrice: before.last_purchase_unit_price
          ? parseFloat(String(before.last_purchase_unit_price))
          : null,
      },
      { displayName: audit?.displayName || "system", reason: "price_update" }
    );
  }

  return { ok: true, message: "✅ อัปเดตราคาสำเร็จ" };
}

async function loadReportTxnRows(
  supabase: ReturnType<typeof createAdminClient>,
  filters: ReportFilters
) {
  const hasCategoryCol = await itemsTableHasCategoryCode(supabase);
  const itemsRes = hasCategoryCol
    ? await supabase.from("items").select("item_code, category_code")
    : await supabase.from("items").select("item_code");
  if (itemsRes.error) throw itemsRes.error;

  const itemCategoryMap = new Map<string, ItemCategoryCode>();
  for (const row of itemsRes.data || []) {
    const code = String((row as { item_code: string }).item_code);
    const cat =
      hasCategoryCol && "category_code" in row
        ? String((row as { category_code?: string }).category_code || "")
        : "";
    itemCategoryMap.set(
      code,
      isItemCategoryCode(cat) ? cat : DEFAULT_ITEM_CATEGORY
    );
  }

  const allowedItemCodes = buildCategoryFilter(filters.categoryCode, itemCategoryMap);

  let query = supabase.from("transactions").select("*");
  if (filters.dateFrom) query = query.gte("txn_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("txn_date", filters.dateTo);
  if (filters.suppCode) query = query.eq("supp_code", filters.suppCode);
  if (filters.itemCode) query = query.eq("item_code", filters.itemCode);

  const { data, error } = await query.order("txn_date", { ascending: true });
  if (error) throw error;

  const filtered = filterRowsByCategory((data || []) as ReportTxnRow[], allowedItemCodes);
  return { filtered, itemCategoryMap };
}

export async function getReportData(filters: ReportFilters) {
  const supabase = createAdminClient();
  const categories = await listItemCategories().catch(() => [] as ItemCategory[]);
  const { filtered, itemCategoryMap } = await loadReportTxnRows(supabase, filters);

  const aggregates = aggregateReportRows(filtered, itemCategoryMap, categories);

  const page = Math.max(1, parseInt(String(filters.page || 1), 10) || 1);
  const pageSize = Math.min(200, Math.max(10, parseInt(String(filters.pageSize || 50), 10) || 50));
  const sortedRows = [...filtered].sort((a, b) => {
    const da = toDateStr(a.txn_date);
    const db = toDateStr(b.txn_date);
    if (da !== db) return db.localeCompare(da);
    return (Number(b.no) || 0) - (Number(a.no) || 0);
  });
  const totalRows = sortedRows.length;
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  let previousPeriod: {
    summary: { totalCost: number; totalTrans: number };
    changePct: { totalCost: number | null; totalTrans: number | null };
  } | null = null;

  if (filters.dateFrom && filters.dateTo) {
    const prevRange = previousPeriodRange(filters.dateFrom, filters.dateTo);
    if (prevRange) {
      const { filtered: prevFiltered } = await loadReportTxnRows(supabase, {
        ...filters,
        dateFrom: prevRange.dateFrom,
        dateTo: prevRange.dateTo,
      });
      const prevAgg = aggregateReportRows(prevFiltered, itemCategoryMap, categories);
      previousPeriod = {
        summary: {
          totalCost: prevAgg.summary.totalCost,
          totalTrans: prevAgg.summary.totalTrans,
        },
        changePct: {
          totalCost: pctChange(aggregates.summary.totalCost, prevAgg.summary.totalCost),
          totalTrans: pctChange(aggregates.summary.totalTrans, prevAgg.summary.totalTrans),
        },
      };
    }
  }

  const dataDateRange = reportDataDateRange(aggregates.byDate);

  return {
    success: true,
    dataDateRange,
    summary: aggregates.summary,
    previousPeriod,
    byCategory: aggregates.byCategory,
    itemCategories: categories,
    byItem: aggregates.byItem,
    bySupp: aggregates.bySupp,
    byDate: aggregates.byDate,
    cumulativeByDate: aggregates.cumulativeByDate,
    topItemsByValue: aggregates.topItemsByValue,
    topItemsByQty: aggregates.topItemsByQty,
    priceVarianceByMonth: aggregates.priceVarianceByMonth,
    weeklyHeatmap: aggregates.weeklyHeatmap,
    rows: pageRows.map((r) => ({
      no: r.no,
      date: toDateStr(r.txn_date),
      suppCode: r.supp_code,
      suppName: r.supp_name,
      itemCode: r.item_code,
      itemNameTH: r.item_name_th,
      qty: r.qty,
      mainUnit: r.main_unit,
      totalPrice: r.total_price,
    })),
    pagination: {
      page,
      pageSize,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    },
  };
}

export function reportRowsToCsv(
  rows: Array<{
    no?: number;
    date: string;
    suppName: string;
    itemNameTH: string;
    qty: number | string;
    mainUnit: string;
    totalPrice: number | string;
  }>
) {
  const header = "no,date,shop,item,qty,unit,total_price";
  const lines = rows.map((r) => {
    const qty = String(r.qty).replace(/"/g, '""');
    const shop = String(r.suppName).replace(/"/g, '""');
    const item = String(r.itemNameTH).replace(/"/g, '""');
    return `${r.no ?? ""},${r.date},"${shop}","${item}",${qty},${r.mainUnit},${r.totalPrice}`;
  });
  return [header, ...lines].join("\n");
}
