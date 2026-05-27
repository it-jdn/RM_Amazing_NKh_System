/**
 * Audit intake slips for duplicate item rows (same item, multiple units on one slip).
 *   DEPLOY_ENV=production npm run audit:slip-duplicates
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

type TxnRow = {
  no: number;
  slip_id: string;
  txn_date: string;
  supp_code: string;
  supp_name: string;
  item_code: string;
  item_name_th: string;
  main_unit: string;
  qty: number | string;
  total_price: number | string;
};

type MultiUnitIssue = {
  slipId: string;
  date: string;
  suppName: string;
  itemCode: string;
  itemName: string;
  units: string[];
  rowCount: number;
  sumTotal: number;
  rows: { no: number; unit: string; qty: number; total: number }[];
};

type SameUnitDupIssue = {
  slipId: string;
  date: string;
  suppName: string;
  itemCode: string;
  itemName: string;
  unit: string;
  rowCount: number;
  sumTotal: number;
  nos: number[];
};

async function fetchAllSlipTransactions(sb: SupabaseClient) {
  const pageSize = 1000;
  const rows: TxnRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("transactions")
      .select(
        "no, slip_id, txn_date, supp_code, supp_name, item_code, item_name_th, main_unit, qty, total_price"
      )
      .not("slip_id", "is", null)
      .order("slip_id")
      .order("no")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as TxnRow[];
    if (!page.length) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function parseNum(v: number | string) {
  return parseFloat(String(v)) || 0;
}

function audit(rows: TxnRow[]) {
  const bySlipItem = new Map<string, TxnRow[]>();
  const bySlipItemUnit = new Map<string, TxnRow[]>();

  for (const r of rows) {
    const unit = String(r.main_unit || "").trim();
    const slipItemKey = `${r.slip_id}||${r.item_code}`;
    const slipItemUnitKey = `${r.slip_id}||${r.item_code}||${unit}`;

    if (!bySlipItem.has(slipItemKey)) bySlipItem.set(slipItemKey, []);
    bySlipItem.get(slipItemKey)!.push(r);

    if (!bySlipItemUnit.has(slipItemUnitKey)) bySlipItemUnit.set(slipItemUnitKey, []);
    bySlipItemUnit.get(slipItemUnitKey)!.push(r);
  }

  const multiUnit: MultiUnitIssue[] = [];
  for (const [, group] of bySlipItem) {
    const units = [...new Set(group.map((r) => String(r.main_unit || "").trim()))].filter(Boolean);
    if (units.length <= 1) continue;
    const first = group[0]!;
    multiUnit.push({
      slipId: first.slip_id,
      date: String(first.txn_date).slice(0, 10),
      suppName: first.supp_name,
      itemCode: first.item_code,
      itemName: first.item_name_th,
      units,
      rowCount: group.length,
      sumTotal: group.reduce((s, r) => s + parseNum(r.total_price), 0),
      rows: group.map((r) => ({
        no: r.no,
        unit: String(r.main_unit || "").trim(),
        qty: parseNum(r.qty),
        total: parseNum(r.total_price),
      })),
    });
  }

  const sameUnitDup: SameUnitDupIssue[] = [];
  for (const [, group] of bySlipItemUnit) {
    if (group.length <= 1) continue;
    const first = group[0]!;
    sameUnitDup.push({
      slipId: first.slip_id,
      date: String(first.txn_date).slice(0, 10),
      suppName: first.supp_name,
      itemCode: first.item_code,
      itemName: first.item_name_th,
      unit: String(first.main_unit || "").trim(),
      rowCount: group.length,
      sumTotal: group.reduce((s, r) => s + parseNum(r.total_price), 0),
      nos: group.map((r) => r.no),
    });
  }

  multiUnit.sort((a, b) => b.date.localeCompare(a.date) || a.suppName.localeCompare(b.suppName));
  sameUnitDup.sort((a, b) => b.date.localeCompare(a.date) || a.suppName.localeCompare(b.suppName));

  return { multiUnit, sameUnitDup };
}

async function main() {
  loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key);

  console.log("Loading transactions with slip_id…");
  const rows = await fetchAllSlipTransactions(sb);
  console.log(`Rows on slips: ${rows.length}\n`);

  const { multiUnit, sameUnitDup } = audit(rows);

  console.log("=== สินค้าเดียวกัน หลายหน่วย ในใบเดียว (แบบเคสผักชี) ===");
  if (!multiUnit.length) {
    console.log("ไม่พบ\n");
  } else {
    console.log(`พบ ${multiUnit.length} กรณี:\n`);
    for (const m of multiUnit) {
      console.log(
        `- ${m.date} | ${m.suppName} | ${m.itemCode} ${m.itemName} | หน่วย: ${m.units.join(" + ")} | ${m.rowCount} แถว | รวม ₩${m.sumTotal.toLocaleString()}`
      );
      for (const r of m.rows) {
        console.log(`    no ${r.no}: ${r.unit} qty ${r.qty} ₩${r.total}`);
      }
      console.log(`  slip_id: ${m.slipId}\n`);
    }
  }

  console.log("=== สินค้า+หน่วยเดียวกัน ซ้ำหลายแถว (ควรรวม/ลบ) ===");
  if (!sameUnitDup.length) {
    console.log("ไม่พบ\n");
  } else {
    console.log(`พบ ${sameUnitDup.length} กรณี:\n`);
    for (const d of sameUnitDup) {
      console.log(
        `- ${d.date} | ${d.suppName} | ${d.itemCode} ${d.itemName} | ${d.unit} | ${d.rowCount} แถว | nos ${d.nos.join(",")} | รวม ₩${d.sumTotal.toLocaleString()}`
      );
      console.log(`  slip_id: ${d.slipId}\n`);
    }
  }

  console.log("สรุป:");
  console.log(`  หลายหน่วยต่อใบ (เคสผักชี): ${multiUnit.length}`);
  console.log(`  หน่วยเดียวกันซ้ำแถว:     ${sameUnitDup.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
