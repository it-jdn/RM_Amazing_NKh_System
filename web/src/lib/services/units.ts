import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeUnitKey,
  unitCodeFromKey,
  type UnitKind,
  type UnitPairHint,
  type UnitRow,
} from "@/lib/domain/units";
import { unitPrimaryName } from "@/lib/i18n/unit-display-name";

type UnitDbRow = {
  unit_code: string;
  display_name?: string | null;
  unit_name_th?: string | null;
  unit_name_en?: string | null;
  unit_name_kr?: string | null;
  usage_count_main?: number | null;
  usage_count_sub?: number | null;
};

type UnitAccumulator = {
  displayName: string;
  usageCountMain: number;
  usageCountSub: number;
  source: string;
};

export type ResolvedUnit = { code: string; displayName: string };

function mapUnitFromDb(u: UnitDbRow): UnitRow {
  const th = String(u.unit_name_th ?? u.display_name ?? "");
  return {
    unitCode: String(u.unit_code),
    nameTH: th,
    nameEN: String(u.unit_name_en ?? ""),
    nameKR: String(u.unit_name_kr ?? ""),
    usageCountMain: Number(u.usage_count_main) || 0,
    usageCountSub: Number(u.usage_count_sub) || 0,
  };
}

function unitNamesPayload(names: { nameTH: string; nameEN?: string; nameKR?: string }) {
  const th = names.nameTH.trim();
  return {
    unit_name_th: th,
    unit_name_en: (names.nameEN || "").trim(),
    unit_name_kr: (names.nameKR || "").trim(),
    display_name: th,
    normalized_key: normalizeUnitKey(th),
  };
}

function compareUnitNames(a: UnitRow, b: UnitRow) {
  return a.nameTH.localeCompare(b.nameTH, "th");
}

function pickDisplayName(current: string, candidate: string, count: number) {
  if (!current) return candidate;
  if (count > 1 && candidate.length > current.length) return candidate;
  return current;
}

function wrapUnitsDbError(error: { code?: string; message?: string }): Error {
  if (error.code === "PGRST205" || error.message?.includes("public.units")) {
    return new Error(
      "ยังไม่ได้ติดตั้งตารางหน่วย (units) — รัน migration 005 และ 006 ใน Supabase: web/supabase/migrations/"
    );
  }
  return new Error(error.message || "Database error");
}

export async function rebuildUnitsFromTransactions(): Promise<{
  unitsUpserted: number;
  pairsUpserted: number;
}> {
  const supabase = createAdminClient();

  const { error: unitsProbeErr } = await supabase.from("units").select("unit_code").limit(1);
  if (unitsProbeErr) throw wrapUnitsDbError(unitsProbeErr);

  const [{ data: txns, error: txnErr }, { data: itemRows, error: itemErr }] = await Promise.all([
    supabase.from("transactions").select("main_unit, sub_unit, convert_rate, item_code, supp_code"),
    supabase.from("items").select("main_unit, sub_unit"),
  ]);
  if (txnErr) throw wrapUnitsDbError(txnErr);
  if (itemErr) throw wrapUnitsDbError(itemErr);

  const { data: existingUnits, error: existErr } = await supabase
    .from("units")
    .select("unit_code, normalized_key");
  if (existErr) throw wrapUnitsDbError(existErr);

  const unitMap = new Map<string, UnitAccumulator>();

  function ingest(raw: string, kind: "main" | "sub", source: string) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return;
    const key = normalizeUnitKey(trimmed);
    const cur = unitMap.get(key) || {
      displayName: trimmed,
      usageCountMain: 0,
      usageCountSub: 0,
      source,
    };
    if (kind === "main") {
      cur.usageCountMain += 1;
      cur.displayName = pickDisplayName(cur.displayName, trimmed, cur.usageCountMain);
    } else {
      cur.usageCountSub += 1;
    }
    unitMap.set(key, cur);
  }

  for (const t of txns || []) {
    ingest(t.main_unit, "main", "transaction");
    ingest(t.sub_unit, "sub", "transaction");
  }
  for (const i of itemRows || []) {
    ingest(i.main_unit, "main", "item");
    ingest(i.sub_unit, "sub", "item");
  }

  const taken = new Set<string>();
  const keyToCode = new Map<string, string>();
  for (const u of existingUnits || []) {
    const key = String(u.normalized_key);
    const code = String(u.unit_code);
    keyToCode.set(key, code);
    taken.add(code);
  }

  const unitRows: Record<string, unknown>[] = [];

  for (const [key, acc] of unitMap) {
    const code = keyToCode.get(key) ?? unitCodeFromKey(key, taken);
    keyToCode.set(key, code);
    const th = acc.displayName;
    unitRows.push({
      unit_code: code,
      display_name: th,
      unit_name_th: th,
      unit_name_en: "",
      unit_name_kr: "",
      normalized_key: key,
      usage_count_main: acc.usageCountMain,
      usage_count_sub: acc.usageCountSub,
      source: acc.source,
      active: true,
    });
  }

  if (unitRows.length) {
    const { error } = await supabase.from("units").upsert(unitRows, { onConflict: "normalized_key" });
    if (error) throw wrapUnitsDbError(error);
  }

  const pairMap = new Map<
    string,
    { main: string; sub: string; rate: number; count: number; item?: string; supp?: string }
  >();

  for (const t of txns || []) {
    const mainKey = normalizeUnitKey(String(t.main_unit || ""));
    const subKey = normalizeUnitKey(String(t.sub_unit || ""));
    if (!mainKey || !subKey) continue;
    const mainCode = keyToCode.get(mainKey);
    const subCode = keyToCode.get(subKey);
    if (!mainCode || !subCode) continue;
    const rate = parseFloat(String(t.convert_rate)) || 1;
    const itemCode = t.item_code ? String(t.item_code) : "";
    const suppCode = t.supp_code ? String(t.supp_code) : "";
    const pk = `${mainCode}|${subCode}|${rate}|${itemCode}|${suppCode}`;
    const cur = pairMap.get(pk);
    if (cur) cur.count += 1;
    else
      pairMap.set(pk, {
        main: mainCode,
        sub: subCode,
        rate,
        count: 1,
        item: itemCode || undefined,
        supp: suppCode || undefined,
      });
  }

  const { error: delErr } = await supabase
    .from("unit_pair_hints")
    .delete()
    .gte("id", 1);
  if (delErr && delErr.code !== "PGRST116") throw wrapUnitsDbError(delErr);

  const pairRows = [...pairMap.values()].map((p) => ({
    main_unit_code: p.main,
    sub_unit_code: p.sub,
    convert_rate: p.rate,
    use_count: p.count,
    item_code: p.item || null,
    supp_code: p.supp || null,
  }));

  if (pairRows.length) {
    const { error: pairErr } = await supabase.from("unit_pair_hints").insert(pairRows);
    if (pairErr) throw wrapUnitsDbError(pairErr);
  }

  await syncMappingUnitsFromItems(keyToCode, supabase);

  return { unitsUpserted: unitRows.length, pairsUpserted: pairRows.length };
}

async function syncMappingUnitsFromItems(
  keyToCode: Map<string, string>,
  supabase: ReturnType<typeof createAdminClient>
) {
  const { data: items, error: itemsErr } = await supabase.from("items").select("*");
  if (itemsErr) throw wrapUnitsDbError(itemsErr);
  const { data: maps, error: mapsErr } = await supabase.from("supplier_item_mapping").select("*");
  if (mapsErr) throw wrapUnitsDbError(mapsErr);

  const mapProbe = maps?.[0];
  const itemProbe = items?.[0];

  for (const i of items || []) {
    const mainKey = normalizeUnitKey(String(i.main_unit || ""));
    const subKey = normalizeUnitKey(String(i.sub_unit || ""));
    const mainCode = keyToCode.get(mainKey);
    const subCode = keyToCode.get(subKey);
    if ((mainCode || subCode) && itemProbe && "main_unit_code" in itemProbe) {
      const { error } = await supabase
        .from("items")
        .update({
          main_unit_code: mainCode || null,
          sub_unit_code: subCode || null,
        })
        .eq("item_code", i.item_code);
      if (error) throw wrapUnitsDbError(error);
    }
  }

  if (!mapProbe || !("main_unit_code" in mapProbe)) return;

  for (const m of maps || []) {
    const item = (items || []).find((i) => i.item_code === m.item_code);
    if (!item) continue;
    const mainKey = normalizeUnitKey(String(item.main_unit || ""));
    const subKey = normalizeUnitKey(String(item.sub_unit || ""));
    const mainCode = keyToCode.get(mainKey);
    const subCode = keyToCode.get(subKey);
    const convert = parseFloat(String(item.convert_rate)) || 1;
    const standard =
      m.standard_unit_price != null
        ? parseFloat(String(m.standard_unit_price)) || 0
        : parseFloat(String(m.unit_price)) || 0;
    const { error } = await supabase
      .from("supplier_item_mapping")
      .update({
        main_unit_code: mainCode || null,
        sub_unit_code: subCode || null,
        convert_rate: m.convert_rate ?? convert,
        standard_unit_price: standard,
      })
      .eq("supp_code", m.supp_code)
      .eq("item_code", m.item_code);
    if (error) throw wrapUnitsDbError(error);
  }
}

export async function resolveUnitCode(
  supabase: ReturnType<typeof createAdminClient>,
  displayOrCode: string
): Promise<ResolvedUnit | null> {
  const raw = String(displayOrCode || "").trim();
  if (!raw) return null;

  const { data: byCode } = await supabase.from("units").select("*").eq("unit_code", raw).maybeSingle();
  if (byCode) {
    const row = mapUnitFromDb(byCode as UnitDbRow);
    return { code: row.unitCode, displayName: unitPrimaryName(row) };
  }

  const key = normalizeUnitKey(raw);
  const { data: byKey } = await supabase.from("units").select("*").eq("normalized_key", key).maybeSingle();
  if (byKey) {
    const row = mapUnitFromDb(byKey as UnitDbRow);
    return { code: row.unitCode, displayName: unitPrimaryName(row) };
  }

  const taken = new Set<string>();
  const { data: all } = await supabase.from("units").select("unit_code");
  for (const u of all || []) taken.add(String(u.unit_code));

  const code = unitCodeFromKey(key, taken);
  const { error } = await supabase.from("units").insert({
    unit_code: code,
    display_name: raw,
    unit_name_th: raw,
    unit_name_en: "",
    unit_name_kr: "",
    normalized_key: key,
    source: "manual",
    active: true,
  });
  if (error) throw error;
  return { code, displayName: raw };
}

/** Master catalog: all active units, A–Z (for app-wide load once). */
export async function listMasterUnits(): Promise<UnitRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("units").select("*").eq("active", true);
  if (error) throw wrapUnitsDbError(error);
  return (data || [])
    .map((u) => mapUnitFromDb(u as UnitDbRow))
    .sort(compareUnitNames);
}

async function renameMasterUnitCode(
  supabase: ReturnType<typeof createAdminClient>,
  oldCode: string,
  newCode: string
) {
  const o = oldCode.trim();
  const n = newCode.trim().toUpperCase();
  if (!n || o === n) return;

  const { data: oldRow, error: fetchErr } = await supabase
    .from("units")
    .select("*")
    .eq("unit_code", o)
    .maybeSingle();
  if (fetchErr) throw wrapUnitsDbError(fetchErr);
  if (!oldRow) throw new Error(`❌ ไม่พบหน่วย "${o}"`);

  const { data: taken } = await supabase.from("units").select("unit_code").eq("unit_code", n).maybeSingle();
  if (taken) throw new Error(`❌ รหัสหน่วย "${n}" ถูกใช้แล้ว`);

  // FK targets must exist before child rows are updated (cannot UPDATE units PK in place).
  const { error: insErr } = await supabase.from("units").insert({
    unit_code: n,
    display_name: oldRow.display_name,
    normalized_key: `__rename__${n}`,
    unit_name_th: oldRow.unit_name_th,
    unit_name_en: oldRow.unit_name_en ?? "",
    unit_name_kr: oldRow.unit_name_kr ?? "",
    usage_count_main: oldRow.usage_count_main ?? 0,
    usage_count_sub: oldRow.usage_count_sub ?? 0,
    last_used_at: oldRow.last_used_at,
    source: oldRow.source ?? "manual",
    active: oldRow.active ?? true,
  });
  if (insErr) throw wrapUnitsDbError(insErr);

  const fkCols = ["main_unit_code", "sub_unit_code"] as const;
  const tables = [
    "items",
    "supplier_item_mapping",
    "unit_pair_hints",
    "item_versions",
    "supplier_item_mapping_versions",
  ] as const;

  for (const table of tables) {
    for (const col of fkCols) {
      const { error } = await supabase.from(table).update({ [col]: n }).eq(col, o);
      if (error) throw wrapUnitsDbError(error);
    }
  }

  const { error: delErr } = await supabase.from("units").delete().eq("unit_code", o);
  if (delErr) throw wrapUnitsDbError(delErr);
}

export async function createMasterUnit(names: {
  nameTH: string;
  nameEN?: string;
  nameKR?: string;
  unitCode?: string;
}) {
  const supabase = createAdminClient();
  const th = names.nameTH.trim();
  if (!th) return { ok: false, message: "❌ กรุณากรอกชื่อหน่วย (ไทย)" };

  const payload = unitNamesPayload(names);
  const { data: dup } = await supabase
    .from("units")
    .select("unit_code, unit_name_th")
    .eq("normalized_key", payload.normalized_key)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      message: `❌ มีหน่วย "${dup.unit_name_th || th}" อยู่แล้ว`,
    };
  }

  const taken = new Set<string>();
  const { data: all } = await supabase.from("units").select("unit_code");
  for (const u of all || []) taken.add(String(u.unit_code));

  const custom = String(names.unitCode || "").trim().toUpperCase();
  let code: string;
  if (custom) {
    if (taken.has(custom)) {
      return { ok: false, message: `❌ รหัสหน่วย "${custom}" ถูกใช้แล้ว` };
    }
    code = custom;
  } else {
    code = unitCodeFromKey(payload.normalized_key, taken);
  }

  const { error } = await supabase.from("units").insert({
    unit_code: code,
    ...payload,
    source: "manual",
    active: true,
  });
  if (error) throw wrapUnitsDbError(error);

  const unit = mapUnitFromDb({
    unit_code: code,
    unit_name_th: payload.unit_name_th,
    unit_name_en: payload.unit_name_en,
    unit_name_kr: payload.unit_name_kr,
    usage_count_main: 0,
    usage_count_sub: 0,
  });

  return {
    ok: true,
    message: `✅ เพิ่มหน่วย "${unitPrimaryName(unit)}" สำเร็จ`,
    unit,
  };
}

export async function updateMasterUnit(
  unitCode: string,
  names: { nameTH: string; nameEN?: string; nameKR?: string; newUnitCode?: string }
) {
  const supabase = createAdminClient();
  let code = String(unitCode).trim();
  const th = names.nameTH.trim();
  if (!th) return { ok: false, message: "❌ กรุณากรอกชื่อหน่วย (ไทย)" };

  const { data: row } = await supabase.from("units").select("*").eq("unit_code", code).maybeSingle();
  if (!row) return { ok: false, message: "❌ ไม่พบหน่วยนี้" };

  const newCode = String(names.newUnitCode || "").trim().toUpperCase();
  if (newCode && newCode !== code) {
    const { data: taken } = await supabase
      .from("units")
      .select("unit_code")
      .eq("unit_code", newCode)
      .maybeSingle();
    if (taken) return { ok: false, message: `❌ รหัสหน่วย "${newCode}" ถูกใช้แล้ว` };
    await renameMasterUnitCode(supabase, code, newCode);
    code = newCode;
  }

  const payload = unitNamesPayload(names);
  const { data: dup } = await supabase
    .from("units")
    .select("unit_code")
    .eq("normalized_key", payload.normalized_key)
    .neq("unit_code", code)
    .maybeSingle();
  if (dup) return { ok: false, message: `❌ ชื่อซ้ำกับหน่วยอื่น` };

  const { error } = await supabase.from("units").update(payload).eq("unit_code", code);
  if (error) throw wrapUnitsDbError(error);

  const unit = mapUnitFromDb({ ...(row as UnitDbRow), ...payload, unit_code: code });
  return {
    ok: true,
    message: `✅ บันทึกหน่วย "${unitPrimaryName(unit)}" สำเร็จ`,
    unit,
  };
}

async function countUnitUsage(supabase: ReturnType<typeof createAdminClient>, code: string) {
  const [itemsMain, itemsSub, mapMain, mapSub, pairMain, pairSub] = await Promise.all([
    supabase.from("items").select("*", { count: "exact", head: true }).eq("main_unit_code", code),
    supabase.from("items").select("*", { count: "exact", head: true }).eq("sub_unit_code", code),
    supabase
      .from("supplier_item_mapping")
      .select("*", { count: "exact", head: true })
      .eq("main_unit_code", code),
    supabase
      .from("supplier_item_mapping")
      .select("*", { count: "exact", head: true })
      .eq("sub_unit_code", code),
    supabase
      .from("unit_pair_hints")
      .select("*", { count: "exact", head: true })
      .eq("main_unit_code", code),
    supabase
      .from("unit_pair_hints")
      .select("*", { count: "exact", head: true })
      .eq("sub_unit_code", code),
  ]);

  for (const r of [itemsMain, itemsSub, mapMain, mapSub, pairMain, pairSub]) {
    if (r.error) throw wrapUnitsDbError(r.error);
  }

  return (
    (itemsMain.count ?? 0) +
    (itemsSub.count ?? 0) +
    (mapMain.count ?? 0) +
    (mapSub.count ?? 0) +
    (pairMain.count ?? 0) +
    (pairSub.count ?? 0)
  );
}

export async function deleteMasterUnit(unitCode: string) {
  const supabase = createAdminClient();
  const code = String(unitCode).trim();
  if (!code) return { ok: false, message: "❌ ไม่พบหน่วย" };

  const { data: row, error: loadErr } = await supabase
    .from("units")
    .select("*")
    .eq("unit_code", code)
    .maybeSingle();
  if (loadErr) throw wrapUnitsDbError(loadErr);
  if (!row) return { ok: false, message: "❌ ไม่พบหน่วยนี้" };

  const usage = await countUnitUsage(supabase, code);
  if (usage > 0) {
    return {
      ok: false,
      message: `❌ ไม่สามารถลบได้ — หน่วยนี้ถูกใช้ในสินค้าหรือการตั้งค่า (${usage} จุดอ้างอิง)`,
    };
  }

  const { error: pairErr } = await supabase
    .from("unit_pair_hints")
    .delete()
    .or(`main_unit_code.eq.${code},sub_unit_code.eq.${code}`);
  if (pairErr) throw wrapUnitsDbError(pairErr);

  const { error } = await supabase.from("units").delete().eq("unit_code", code);
  if (error) throw wrapUnitsDbError(error);

  const unit = mapUnitFromDb(row as UnitDbRow);
  return { ok: true, message: `✅ ลบหน่วย "${unitPrimaryName(unit)}" (${code}) แล้ว` };
}

export async function listUnits(kind: UnitKind = "all"): Promise<UnitRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("units").select("*").eq("active", true);
  if (error) throw error;

  let rows = (data || []).map((u) => mapUnitFromDb(u as UnitDbRow));

  if (kind === "main") {
    rows = rows.sort((a, b) => b.usageCountMain - a.usageCountMain || compareUnitNames(a, b));
  } else if (kind === "sub") {
    rows = rows.sort((a, b) => b.usageCountSub - a.usageCountSub || compareUnitNames(a, b));
  } else {
    rows = rows.sort(
      (a, b) =>
        b.usageCountMain + b.usageCountSub - (a.usageCountMain + a.usageCountSub) || compareUnitNames(a, b)
    );
  }
  return rows;
}

export async function listUnitPairs(filters?: {
  itemCode?: string;
  suppCode?: string;
  mainUnitCode?: string;
}): Promise<UnitPairHint[]> {
  const supabase = createAdminClient();
  let query = supabase.from("unit_pair_hints").select("*");
  if (filters?.itemCode) query = query.eq("item_code", filters.itemCode);
  if (filters?.suppCode) query = query.eq("supp_code", filters.suppCode);
  if (filters?.mainUnitCode) query = query.eq("main_unit_code", filters.mainUnitCode);

  const { data, error } = await query.order("use_count", { ascending: false }).limit(50);
  if (error) throw error;

  const codes = new Set<string>();
  for (const r of data || []) {
    codes.add(String(r.main_unit_code));
    codes.add(String(r.sub_unit_code));
  }
  const { data: units } = await supabase
    .from("units")
    .select("unit_code, display_name, unit_name_th, unit_name_en, unit_name_kr")
    .in("unit_code", [...codes]);
  const nameMap = new Map(
    (units || []).map((u) => [String(u.unit_code), unitPrimaryName(mapUnitFromDb(u as UnitDbRow))])
  );

  return (data || []).map((r) => ({
    mainUnitCode: String(r.main_unit_code),
    subUnitCode: String(r.sub_unit_code),
    convertRate: parseFloat(String(r.convert_rate)) || 1,
    useCount: Number(r.use_count) || 0,
    mainDisplayName: nameMap.get(String(r.main_unit_code)),
    subDisplayName: nameMap.get(String(r.sub_unit_code)),
  }));
}
