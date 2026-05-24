/**
 * Create / map items for rows skipped during migration Excel import.
 *
 *   npm run sync:migration-items -- --dry-run
 *   DEPLOY_ENV=production npm run sync:migration-items -- --apply
 *
 * Writes Backup/imports/migration-item-remap.json for import-transactions.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

const DEFAULT_XLSX = path.resolve(
  __dirname,
  "../../Backup/Amazing Nkh-Data Migration_2026 (1).xlsx"
);
const REMAP_OUT = path.resolve(
  __dirname,
  "../../Backup/imports/migration-item-remap.json"
);
const REPORT_OUT = path.resolve(
  __dirname,
  "../../Backup/imports/migration-items-report.md"
);

const CUTOFF = "2026-05-17";

type ParsedName = { th: string; en: string; kr: string; full: string };
type ExcelItemAgg = {
  excelCode: string;
  names: ParsedName;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  supps: Set<string>;
  rowCount: number;
};

type DbItem = {
  item_code: string;
  item_name_th: string;
  item_name_en: string;
  item_name_kr: string;
  main_unit: string;
  sub_unit: string;
  convert_rate: number;
};

type MapDecision =
  | { action: "map"; excelCode: string; dbCode: string; reason: string }
  | { action: "create"; excelCode: string; dbCode: string; reason: string; row: Record<string, unknown> };

function parseNames(raw: string): ParsedName {
  const full = String(raw || "").trim();
  const parts = full.split(" / ").map((p) => p.trim());
  return {
    th: parts[0] || full,
    en: parts[1] || "",
    kr: parts[2] || "",
    full,
  };
}

function normTh(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  return String(v ?? "").slice(0, 10);
}

function guessCategory(names: ParsedName): string {
  const t = `${names.th} ${names.en}`.toLowerCase();
  if (/เบียร์|beer|โซจู|คาส|coke|sprite|fanta|น้ำมะ|lemonade|coconut water|drink|เครื่องดื่ม/i.test(t))
    return "BEV";
  if (/หมู|เนื้อ|กุ้ง|ปลา|ไก่|sausage|meat|shrimp|pork|beef|seafood|ปู/i.test(t))
    return "PROT";
  if (/ซอส|น้ำจิ้ม|ผง|msg|seasoning|sriracha|soup powder|รสดี|five-spice/i.test(t))
    return "SEA";
  if (/แป้ง|bread flour|noodle|rice|ข้าว/i.test(t)) return "PANTRY";
  return "PROD";
}

async function nextItemCode(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.from("items").select("item_code");
  const nums = (data || [])
    .map((r) => String(r.item_code))
    .filter((c) => /^RM\d+$/i.test(c))
    .map((c) => parseInt(c.replace(/^RM/i, ""), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return "RM" + String(next).padStart(5, "0");
}

function collectExcelMissing(
  rows: Record<string, unknown>[],
  itemSet: Set<string>
): Map<string, ExcelItemAgg> {
  const map = new Map<string, ExcelItemAgg>();
  for (const raw of rows) {
    const code = String(raw["รหัสสินค้า"] ?? "").trim();
    const date = parseDate(raw["วันที่รับสินค้า"]);
    const qty = Number(raw["จำนวน"]) || 0;
    const price = Number(raw["ราคารวม"]) || 0;
    const supp = String(raw["รหัสร้าน"] ?? "").trim();
    if (!code || !date || itemSet.has(code)) continue;
    if (date >= CUTOFF || date >= "2028-01-01") continue;
    if (qty <= 0 && price <= 0) continue;

    const names = parseNames(String(raw["ชื่อสินค้า"] ?? ""));
    const mainUnit = String(raw["หน่วย"] ?? "").trim();
    const subUnit = String(raw["หน่วยย่อย"] ?? "").trim();
    const convertRate = Number(raw["ค่าแปลง"]) || 1;

    if (!map.has(code)) {
      map.set(code, {
        excelCode: code,
        names,
        mainUnit,
        subUnit,
        convertRate,
        supps: new Set(),
        rowCount: 0,
      });
    }
    const a = map.get(code)!;
    a.rowCount++;
    if (supp) a.supps.add(supp);
    if (!a.mainUnit && mainUnit) a.mainUnit = mainUnit;
    if (!a.subUnit && subUnit) a.subUnit = subUnit;
    if (convertRate > 0) a.convertRate = convertRate;
  }
  return map;
}

function decideMapping(
  agg: ExcelItemAgg,
  dbItems: DbItem[],
  mappingBySupp: Map<string, Set<string>>
): { dbCode: string; reason: string } | null {
  const n = normTh(agg.names.th);
  const candidates = dbItems.filter((i) => normTh(i.item_name_th) === n);
  if (!candidates.length) return null;

  const scored = candidates.map((c) => {
    let overlap = 0;
    for (const supp of agg.supps) {
      const codes = mappingBySupp.get(supp);
      if (codes?.has(c.item_code)) overlap++;
    }
    const ratio = agg.supps.size ? overlap / agg.supps.size : 0;
    const enMatch =
      !agg.names.en ||
      !c.item_name_en ||
      normTh(agg.names.en) === normTh(c.item_name_en);
    return { c, overlap, ratio, enMatch };
  });

  scored.sort((a, b) => b.ratio - a.ratio || b.overlap - a.overlap);

  const best = scored[0];
  if (!best) return null;

  // ชื่อตรง + ร้านใน Excel ทุกร้านเคยผูกรหัสนี้ใน mapping
  if (best.ratio === 1 && agg.supps.size > 0) {
    return {
      dbCode: best.c.item_code,
      reason: `ชื่อตรง + ร้าน ${agg.supps.size} ร้านผูก ${best.c.item_code} ใน mapping แล้ว`,
    };
  }

  // ชื่อตรงทุกส่วน + มี candidate เดียว
  if (candidates.length === 1 && best.enMatch) {
    return {
      dbCode: best.c.item_code,
      reason: `ชื่อตรง (TH/EN) + มีสินค้าเดียวในระบบ (${best.c.item_code})`,
    };
  }

  // ชื่อตรง + ส่วนใหญ่ของร้านใน Excel ใช้รหัสนี้
  if (best.ratio >= 0.5 && best.overlap >= 1 && best.enMatch) {
    return {
      dbCode: best.c.item_code,
      reason: `ชื่อตรง + ${best.overlap}/${agg.supps.size} ร้านใน Excel ผูก ${best.c.item_code}`,
    };
  }

  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const fileArg = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1];
  const xlsxPath = fileArg ? path.resolve(process.cwd(), fileArg) : DEFAULT_XLSX;

  loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key);

  const [{ data: items }, { data: mappings }] = await Promise.all([
    sb.from("items").select(
      "item_code, item_name_th, item_name_en, item_name_kr, main_unit, sub_unit, convert_rate"
    ),
    sb.from("supplier_item_mapping").select("supp_code, item_code"),
  ]);

  const dbItems = (items || []) as DbItem[];
  const itemSet = new Set(dbItems.map((i) => i.item_code));
  const mappingBySupp = new Map<string, Set<string>>();
  for (const m of mappings || []) {
    if (!mappingBySupp.has(m.supp_code)) mappingBySupp.set(m.supp_code, new Set());
    mappingBySupp.get(m.supp_code)!.add(m.item_code);
  }

  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets.RM || wb.Sheets.Transactions,
    { defval: "" }
  );
  const missing = collectExcelMissing(rows, itemSet);

  const decisions: MapDecision[] = [];
  const remap: Record<string, string> = {};
  const usedCodes = new Set(itemSet);

  for (const agg of [...missing.values()].sort((a, b) =>
    a.excelCode.localeCompare(b.excelCode)
  )) {
    const mapped = decideMapping(agg, dbItems, mappingBySupp);
    if (mapped) {
      decisions.push({
        action: "map",
        excelCode: agg.excelCode,
        dbCode: mapped.dbCode,
        reason: mapped.reason,
      });
      remap[agg.excelCode] = mapped.dbCode;
      continue;
    }

    let dbCode = agg.excelCode;
    if (usedCodes.has(dbCode)) {
      dbCode = await nextItemCode(sb);
      while (usedCodes.has(dbCode)) {
        const n = parseInt(dbCode.replace(/^RM/i, ""), 10) + 1;
        dbCode = "RM" + String(n).padStart(5, "0");
      }
    }
    usedCodes.add(dbCode);

    const row = {
      item_code: dbCode,
      item_name_th: agg.names.th,
      item_name_en: agg.names.en,
      item_name_kr: agg.names.kr,
      main_unit: agg.mainUnit || "Piece / ชิ้น",
      sub_unit: agg.subUnit || agg.mainUnit || "Piece / ชิ้น",
      convert_rate: agg.convertRate || 1,
      category_code: guessCategory(agg.names),
    };

    decisions.push({
      action: "create",
      excelCode: agg.excelCode,
      dbCode,
      reason:
        dbCode === agg.excelCode
          ? "ไม่พบสินค้าเดิมที่ตรงชื่อ+ร้าน — สร้างใหม่ตามรหัสใน Excel"
          : `ไม่แน่ใจ / รหัสชน — สร้างใหม่เป็น ${dbCode}`,
      row,
    });
    remap[agg.excelCode] = dbCode;
  }

  const maps = decisions.filter((d) => d.action === "map");
  const creates = decisions.filter((d) => d.action === "create");

  let report = `# รายงาน sync สินค้าจาก Migration Excel\n\n`;
  report += `- ไฟล์: ${xlsxPath}\n`;
  report += `- โหมด: ${apply ? "apply" : "dry-run"}\n`;
  report += `- รหัสใน Excel ที่ไม่มีใน DB: ${missing.size}\n`;
  report += `- แมปใช้รหัสเดิม: ${maps.length}\n`;
  report += `- สร้างสินค้าใหม่: ${creates.length}\n\n`;

  report += `## แมปกับรหัสเดิม (${maps.length})\n\n`;
  report += `| รหัสใน Excel | ใช้รหัสในระบบ | เหตุผล |\n|---|---|---|\n`;
  for (const d of maps) {
    report += `| ${d.excelCode} | ${d.dbCode} | ${d.reason} |\n`;
  }

  report += `\n## สร้างสินค้าใหม่ (${creates.length})\n\n`;
  report += `| รหัสใน Excel | รหัสที่จะใช้ใน DB | ชื่อ (TH) | เหตุผล |\n|---|---|---|---|\n`;
  for (const d of creates) {
    const row = d.row as { item_name_th: string };
    report += `| ${d.excelCode} | ${d.dbCode} | ${row.item_name_th} | ${d.reason} |\n`;
  }

  fs.mkdirSync(path.dirname(REMAP_OUT), { recursive: true });
  fs.writeFileSync(REMAP_OUT, JSON.stringify(remap, null, 2));
  fs.writeFileSync(REPORT_OUT, report);

  console.log(report);
  console.log(`\nWrote ${REMAP_OUT}`);
  console.log(`Wrote ${REPORT_OUT}`);

  if (!apply) {
    console.log("\n[dry-run] รัน --apply เพื่อ insert สินค้าใหม่");
    return;
  }

  const toInsert = creates.map((d) => d.row);
  for (let i = 0; i < toInsert.length; i += 20) {
    const chunk = toInsert.slice(i, i + 20);
    const { error } = await sb.from("items").insert(chunk);
    if (error) throw error;
  }
  console.log(`\n✅ สร้างสินค้าใหม่ ${toInsert.length} รายการ`);
  console.log(`✅ แมป ${maps.length} รหัส (ไม่ insert — ใช้ remap ตอน import)`);
  console.log("\nขั้นถัดไป:");
  console.log(
    "  DEPLOY_ENV=production npm run import:transactions -- --append --sheet=RM --remap=../Backup/imports/migration-item-remap.json --file=\"../Backup/Amazing Nkh-Data Migration_2026 (1).xlsx\" --before-date=2026-05-17 --skip-invalid-dates"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
