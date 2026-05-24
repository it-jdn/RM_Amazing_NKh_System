/**
 * Import legacy Transactions from Excel (Google Sheets export).
 *
 * Empty DB (default): inserts all valid rows; aborts if transactions already exist.
 * Append mode: use when DB already has data (e.g. staging clone of production).
 *
 * Usage:
 *   npm run import:transactions
 *   npm run import:transactions -- --dry-run
 *   npm run import:transactions -- --append --file="/path/to/export.xlsx"
 *   DEPLOY_ENV=staging npm run import:transactions -- --dry-run --append --file="..."
 *
 * Flags:
 *   --dry-run       Report counts / samples; no insert
 *   --append        Allow import when transactions table is non-empty
 *   --dedupe        Skip rows matching existing DB (default with --append)
 *   --no-dedupe     Insert all valid rows even if key exists in DB
 *   --file=PATH     Excel path (default: Backup/DB File/RM Amazing Nongkhai - DB.xlsx)
 *   --sheet=NAME    Worksheet name (default: Transactions)
 *   --before-date=YYYY-MM-DD   Import only rows strictly before this date (txn_date)
 *   --skip-invalid-dates       Skip rows with txn_date year >= 2028 (Excel corruption)
 *   --remap=PATH               JSON excel_code -> db item_code (from sync:migration-items)
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toDateStr } from "../src/lib/domain/transactions";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

loadDeployEnv();

const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../Backup/DB File/RM Amazing Nongkhai - DB.xlsx"
);

type LegacyRow = Record<string, unknown>;

type MappedRow = {
  no: number;
  date: string;
  suppCode: string;
  suppName: string;
  itemCode: string;
  itemNameTH: string;
  qty: number;
  mainUnit: string;
  convertRate: number;
  subUnit: string;
  totalSub: number;
  unitPrice: number;
  totalPrice: number;
  note: string;
  savedAt: unknown;
  savedByName: string;
};

function num(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function parseDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
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

/** Dedupe key aligned with plan: date + shop + item + saved_at + total_price (+ qty). */
export function dedupeKey(
  date: string,
  suppCode: string,
  itemCode: string,
  savedAt: string,
  totalPrice: number,
  qty: number
): string {
  return `${date}|${suppCode}|${itemCode}|${savedAt}|${totalPrice}|${qty}`;
}

function mapRow(raw: LegacyRow): MappedRow {
  const itemName =
    str(raw.itemNameTH) ||
    str(raw.itemName) ||
    str(raw.item_name_th) ||
    str(raw["ชื่อสินค้า"]);
  const dateSource = raw.date ?? raw["วันที่รับสินค้า"];
  return {
    no: num(raw.no ?? raw["ลำดับ\n(Number)"] ?? raw["ลำดับ"]),
    date: parseDate(dateSource),
    suppCode: str(raw.suppCode ?? raw["รหัสร้าน"]),
    suppName: str(raw.suppName ?? raw["ร้านค้า"]),
    itemCode: str(raw.itemCode ?? raw["รหัสสินค้า"]),
    itemNameTH: itemName,
    qty: num(raw.qty ?? raw["จำนวน"]),
    mainUnit: str(raw.mainUnit ?? raw["หน่วย"]),
    convertRate: num(raw.convertRate ?? raw["ค่าแปลง"]) || 1,
    subUnit: str(raw.subUnit ?? raw["หน่วยย่อย"]),
    totalSub: num(raw.totalSub),
    unitPrice: num(raw.unitPrice ?? raw["ราคาต่อหน่วย"]),
    totalPrice: num(raw.totalPrice ?? raw["ราคารวม"]),
    note: str(raw.note ?? raw["หมายเหตุ"]),
    savedAt: raw.savedAt ?? dateSource,
    savedByName:
      str(raw.savedByName) ||
      str(raw.saved_by_name) ||
      str(raw.savedBy) ||
      str(raw.operatorName) ||
      str(raw["ผู้บันทึก"]),
  };
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const append = argv.includes("--append");
  const dedupe =
    argv.includes("--dedupe") ||
    (append && !argv.includes("--no-dedupe"));
  const fileArg = argv.find((a) => a.startsWith("--file="))?.split("=")[1];
  const sheetArg =
    argv.find((a) => a.startsWith("--sheet="))?.split("=")[1] ||
    "Transactions";
  const xlsxPath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : DEFAULT_XLSX;
  const beforeDate =
    argv.find((a) => a.startsWith("--before-date="))?.split("=")[1] || "";
  const skipInvalidDates = argv.includes("--skip-invalid-dates");
  const remapArg = argv.find((a) => a.startsWith("--remap="))?.split("=")[1];
  const remapPath = remapArg ? path.resolve(process.cwd(), remapArg) : "";
  return {
    dryRun,
    append,
    dedupe,
    xlsxPath,
    sheetName: sheetArg,
    beforeDate,
    skipInvalidDates,
    remapPath,
  };
}

function loadItemRemap(remapPath: string): Record<string, string> {
  if (!remapPath || !fs.existsSync(remapPath)) return {};
  return JSON.parse(fs.readFileSync(remapPath, "utf8")) as Record<string, string>;
}

type TxDedupeRow = {
  txn_date: string;
  supp_code: string;
  item_code: string;
  saved_at: string;
  total_price: number;
  qty: number;
};

async function loadExistingDedupeKeys(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const keys = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("txn_date, supp_code, item_code, saved_at, total_price, qty")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as TxDedupeRow[];
    if (!page.length) break;
    for (const t of page) {
      const saved = String(t.saved_at ?? "").slice(0, 19).replace("T", " ");
      keys.add(
        dedupeKey(
          String(t.txn_date),
          t.supp_code,
          t.item_code,
          saved,
          Number(t.total_price),
          Number(t.qty)
        )
      );
    }
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return keys;
}

async function main() {
  const {
    dryRun,
    append,
    dedupe,
    xlsxPath,
    sheetName,
    beforeDate,
    skipInvalidDates,
    remapPath,
  } = parseArgs(process.argv.slice(2));

  const itemRemap = loadItemRemap(remapPath);
  if (Object.keys(itemRemap).length) {
    console.log(`ใช้ item remap: ${Object.keys(itemRemap).length} รหัส (${remapPath})`);
  }

  if (!fs.existsSync(xlsxPath)) {
    console.error("ไม่พบไฟล์:", xlsxPath);
    process.exit(1);
  }

  const { url, key } = requireSupabaseEnv();
  const deployEnv = process.env.DEPLOY_ENV || "local";
  console.log(`DEPLOY_ENV=${deployEnv}`);
  console.log("อ่านไฟล์:", xlsxPath);

  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.error(`ไม่พบแถบ "${sheetName}" — ใช้ --sheet= หรือตรวจชื่อแถบในไฟล์`);
    console.error("แถบที่มี:", wb.SheetNames.join(", "));
    process.exit(1);
  }

  const rawRows = XLSX.utils.sheet_to_json<LegacyRow>(sheet, { defval: "" });
  console.log(`พบ ${rawRows.length} แถวในแถบ ${sheetName}`);

  const supabase = createClient(url, key);

  const [{ data: supps }, { data: items }, { count: existingCount }] =
    await Promise.all([
      supabase.from("suppliers").select("supp_code"),
      supabase.from("items").select("item_code, main_unit, sub_unit, convert_rate"),
      supabase
        .from("transactions")
        .select("*", { count: "exact", head: true }),
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

  const rows: MappedRow[] = [];
  let skipEmpty = 0;
  let skipFk = 0;
  let skipBeforeDate = 0;
  let skipInvalidDate = 0;
  const skipFkSamples: string[] = [];

  if (beforeDate) console.log(`กรองเฉพาะ txn_date < ${beforeDate}`);
  if (skipInvalidDates) console.log("ข้ามวันที่ปี >= 2028 (ข้อมูล Excel เสีย)");

  for (const raw of rawRows) {
    const r = mapRow(raw);
    if (itemRemap[r.itemCode]) r.itemCode = itemRemap[r.itemCode];
    if (!r.suppCode || !r.itemCode || !r.date) continue;
    if (skipInvalidDates && r.date >= "2028-01-01") {
      skipInvalidDate++;
      continue;
    }
    if (beforeDate && r.date >= beforeDate) {
      skipBeforeDate++;
      continue;
    }
    if (r.qty <= 0 && r.totalPrice <= 0) {
      skipEmpty++;
      continue;
    }
    if (!suppSet.has(r.suppCode) || !itemMap.has(r.itemCode)) {
      skipFk++;
      if (skipFkSamples.length < 10) {
        skipFkSamples.push(
          `${r.date} ${r.suppCode} ${r.itemCode} (${!suppSet.has(r.suppCode) ? "no supplier" : "no item"})`
        );
      }
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

  const dates = rows.map((r) => r.date).sort();
  const dateMin = dates[0];
  const dateMax = dates[dates.length - 1];

  console.log(`\nพร้อมนำเข้า (หลังกรอง FK/ว่าง): ${rows.length} รายการ`);
  if (dateMin) console.log(`  ช่วงวันที่ในไฟล์: ${dateMin} → ${dateMax}`);
  if (skipEmpty) console.log(`  ข้าม (ไม่มี qty/ราคา): ${skipEmpty}`);
  if (skipBeforeDate) console.log(`  ข้าม (วันที่ >= ${beforeDate}): ${skipBeforeDate}`);
  if (skipInvalidDate) console.log(`  ข้าม (วันที่เสีย ปี>=2028): ${skipInvalidDate}`);
  if (skipFk) {
    console.log(`  ข้าม (ไม่มีร้าน/สินค้าใน master): ${skipFk}`);
    if (skipFkSamples.length) {
      console.log("  ตัวอย่าง FK ที่ข้าม:");
      skipFkSamples.forEach((s) => console.log(`    - ${s}`));
    }
  }

  if (!rows.length) {
    console.log("ไม่มีรายการที่นำเข้าได้ — ตรวจ master หรือรัน npm run import:csv");
    process.exit(1);
  }

  const existing = existingCount ?? 0;
  if (!append && existing > 0) {
    console.error(
      `\nฐานข้อมูลมี transactions อยู่แล้ว ${existing} แถว.\n` +
        "ใช้ --append สำหรับนำเข้าเพิ่ม (staging/production ที่มีข้อมูลแล้ว)\n" +
        "หรือลบข้อมูลใน Supabase ก่อนนำเข้าฐานว่าง."
    );
    process.exit(1);
  }

  if (append) {
    console.log(`\nโหมด append — มี transactions ในฐานแล้ว ${existing} แถว`);
  }

  let skipDedupe = 0;
  let skipFileDup = 0;
  const seenInFile = new Set<string>();
  let rowsToInsert = rows;

  if (dedupe) {
    console.log("\nโหลดคีย์ dedupe จากฐานข้อมูล...");
    const existingKeys = await loadExistingDedupeKeys(supabase);
    console.log(`  คีย์ในฐาน: ${existingKeys.size}`);

    const filtered: MappedRow[] = [];
    for (const r of rows) {
      const saved = parseSavedAt(r.savedAt, r.date);
      const key = dedupeKey(
        r.date,
        r.suppCode,
        r.itemCode,
        saved,
        r.totalPrice,
        r.qty
      );
      if (seenInFile.has(key)) {
        skipFileDup++;
        continue;
      }
      seenInFile.add(key);
      if (existingKeys.has(key)) {
        skipDedupe++;
        continue;
      }
      filtered.push(r);
    }
    rowsToInsert = filtered;
    console.log(`  ข้ามซ้ำกับฐาน: ${skipDedupe}`);
    console.log(`  ข้ามซ้ำภายในไฟล์: ${skipFileDup}`);
    console.log(`  จะ insert: ${rowsToInsert.length}`);
  }

  const maxNo = rowsToInsert.reduce((m, r) => Math.max(m, r.no || 0), 0);

  if (dryRun) {
    console.log("\n[dry-run] สรุป");
    console.log(`  append=${append} dedupe=${dedupe} beforeDate=${beforeDate || "(none)"}`);
    console.log(`  insert ได้: ${rowsToInsert.length} แถว`);
    if (rowsToInsert.length) {
      const d0 = rowsToInsert.map((r) => r.date).sort();
      console.log(`  ช่วงวันที่ที่จะเพิ่ม: ${d0[0]} → ${d0[d0.length - 1]}`);
    }
    console.log("\n[dry-run] ตัวอย่าง 3 แถวแรกที่จะ insert:");
    rowsToInsert.slice(0, 3).forEach((r) => {
      console.log({
        date: r.date,
        supp: r.suppCode,
        item: r.itemCode,
        qty: r.qty,
        totalPrice: r.totalPrice,
        savedAt: parseSavedAt(r.savedAt, r.date),
        savedByName: r.savedByName || undefined,
      });
    });
    if (maxNo > 0) {
      console.log(`\n[dry-run] no สูงสุดในไฟล์ที่จะ insert ≈ ${maxNo}`);
    }
    console.log("\n[dry-run] หลังนำเข้าจริง รัน: npm run import:post");
    return;
  }

  if (!rowsToInsert.length) {
    console.log("\nไม่มีแถวใหม่ให้ insert (อาจซ้ำครบแล้ว)");
    return;
  }

  const dbRows = rowsToInsert.map((r) => {
    const row: Record<string, unknown> = {
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
    };
    if (r.savedByName) row.saved_by_name = r.savedByName;
    return row;
  });

  console.log("\nกำลัง insert...");
  for (let i = 0; i < dbRows.length; i += 100) {
    const chunk = dbRows.slice(i, i + 100);
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) throw error;
    process.stdout.write(
      `  ${Math.min(i + 100, dbRows.length)} / ${dbRows.length}\r`
    );
  }
  console.log(`\n✅ นำเข้า ${dbRows.length} รายการสำเร็จ`);
  console.log("\nขั้นถัดไป: npm run import:post");
  if (maxNo > 0) {
    console.log(
      `(หรือรัน setval ใน SQL — import:post จะ sync transaction_no_seq จาก max(no))`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
