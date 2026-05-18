/**
 * Import legacy Transactions from Excel (Google Sheets export).
 *
 * Prerequisites:
 *   1. npm run import:csv   (suppliers, items, mapping)
 *   2. .env.local with Supabase keys
 *
 * Usage:
 *   npm run import:transactions
 *   npm run import:transactions -- --dry-run
 *   npm run import:transactions -- --file "../Backup/DB File/RM Amazing Nongkhai - DB.xlsx"
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { toDateStr } from "../src/lib/domain/transactions";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

loadDeployEnv();

const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../Backup/DB File/RM Amazing Nongkhai - DB.xlsx"
);

type LegacyRow = Record<string, unknown>;

function num(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function parseDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  return toDateStr(v);
}

function parseSavedAt(v: unknown, fallbackDate: string): string {
  const s = str(v);
  if (s) {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.replace("T", " ").slice(0, 19);
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace("T", " ");
    }
  }
  return `${fallbackDate} 12:00:00`;
}

function mapRow(raw: LegacyRow) {
  const itemName =
    str(raw.itemNameTH) ||
    str(raw.itemName) ||
    str(raw.item_name_th);
  return {
    no: num(raw.no),
    date: parseDate(raw.date),
    suppCode: str(raw.suppCode),
    suppName: str(raw.suppName),
    itemCode: str(raw.itemCode),
    itemNameTH: itemName,
    qty: num(raw.qty),
    mainUnit: str(raw.mainUnit),
    convertRate: num(raw.convertRate) || 1,
    subUnit: str(raw.subUnit),
    totalSub: num(raw.totalSub),
    unitPrice: num(raw.unitPrice),
    totalPrice: num(raw.totalPrice),
    note: str(raw.note),
    savedAt: raw.savedAt,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const xlsxPath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : DEFAULT_XLSX;

  if (!fs.existsSync(xlsxPath)) {
    console.error("ไม่พบไฟล์:", xlsxPath);
    process.exit(1);
  }

  const { url, key } = requireSupabaseEnv();

  console.log("อ่านไฟล์:", xlsxPath);
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const sheet = wb.Sheets.Transactions;
  if (!sheet) {
    console.error('ไม่พบแถบ "Transactions" ในไฟล์');
    process.exit(1);
  }

  const rawRows = XLSX.utils.sheet_to_json<LegacyRow>(sheet, { defval: "" });
  console.log(`พบ ${rawRows.length} แถวในแถบ Transactions`);

  const supabase = createClient(url, key);

  const [{ data: supps }, { data: items }] = await Promise.all([
    supabase.from("suppliers").select("supp_code"),
    supabase.from("items").select("item_code, main_unit, sub_unit, convert_rate"),
  ]);

  const suppSet = new Set((supps || []).map((s) => s.supp_code));
  const itemMap = new Map(
    (items || []).map((i) => [
      i.item_code,
      {
        main_unit: i.main_unit,
        sub_unit: i.sub_unit,
        convert_rate: i.convert_rate,
      },
    ])
  );

  const rows: ReturnType<typeof mapRow>[] = [];
  let skipEmpty = 0;
  let skipFk = 0;

  for (const raw of rawRows) {
    const r = mapRow(raw);
    if (!r.suppCode || !r.itemCode || !r.date) continue;
    if (r.qty <= 0 && r.totalPrice <= 0) {
      skipEmpty++;
      continue;
    }
    if (!suppSet.has(r.suppCode) || !itemMap.has(r.itemCode)) {
      skipFk++;
      continue;
    }
    const item = itemMap.get(r.itemCode)!;
    if (!r.mainUnit) r.mainUnit = item.main_unit;
    if (!r.subUnit) r.subUnit = item.sub_unit;
    if (!r.convertRate) r.convertRate = num(item.convert_rate) || 1;
    if (!r.totalSub) r.totalSub = Math.round(r.qty * r.convertRate * 100) / 100;
    if (!r.unitPrice && r.qty > 0 && r.totalPrice > 0) {
      r.unitPrice = Math.round((r.totalPrice / r.qty) * 100) / 100;
    }
    rows.push(r);
  }

  console.log(`พร้อมนำเข้า: ${rows.length} รายการ`);
  if (skipEmpty) console.log(`  ข้าม (ไม่มี qty/ราคา): ${skipEmpty}`);
  if (skipFk) console.log(`  ข้าม (ไม่มีร้าน/สินค้าใน master): ${skipFk}`);

  if (!rows.length) {
    console.log("ไม่มีรายการที่นำเข้าได้ — รัน npm run import:csv ก่อน");
    process.exit(1);
  }

  const maxNo = rows.reduce((m, r) => Math.max(m, r.no || 0), 0);

  if (dryRun) {
    console.log("\n[dry-run] ตัวอย่าง 3 แถวแรก:");
    rows.slice(0, 3).forEach((r) => console.log(r));
    console.log(`\n[dry-run] จะ insert ${rows.length} แถว, no สูงสุด ≈ ${maxNo}`);
    return;
  }

  const { count: existing } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true });

  if (existing && existing > 0) {
    console.error(
      `\nฐานข้อมูลมี transactions อยู่แล้ว ${existing} แถว.\n` +
        "ลบข้อมูลเดิมใน Supabase ก่อน หรือใช้ฐานใหม่ แล้วรันสคริปต์อีกครั้ง.\n" +
        "(ยังไม่รองรับ --force)"
    );
    process.exit(1);
  }

  const dbRows = rows.map((r) => ({
    no: r.no > 0 ? r.no : undefined,
    txn_date: r.date,
    supp_code: r.suppCode,
    supp_name: r.suppName,
    item_code: r.itemCode,
    item_name_th: r.itemNameTH,
    qty: r.qty,
    main_unit: r.mainUnit || null,
    convert_rate: r.convertRate,
    sub_unit: r.subUnit || null,
    total_sub: r.totalSub,
    unit_price: r.unitPrice,
    total_price: r.totalPrice,
    note: r.note,
    saved_at: parseSavedAt(r.savedAt, r.date),
  }));

  console.log("กำลัง insert...");
  for (let i = 0; i < dbRows.length; i += 100) {
    const chunk = dbRows.slice(i, i + 100);
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) throw error;
    process.stdout.write(`  ${Math.min(i + 100, dbRows.length)} / ${dbRows.length}\r`);
  }
  console.log(`\n✅ นำเข้า ${dbRows.length} รายการสำเร็จ`);

  if (maxNo > 0) {
    console.log(
      "\nรัน SQL นี้ใน Supabase SQL Editor เพื่อให้เลข no ใหม่ไม่ชนกับของเก่า:\n"
    );
    console.log(
      `SELECT setval('transaction_no_seq', ${Math.max(maxNo, 1)});`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
