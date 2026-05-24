/**
 * Backfill empty Korean names (items, suppliers, units) with sample translations.
 * Does not overwrite rows that already have item_name_kr / supp_name_kr / unit_name_kr.
 *
 *   DEPLOY_ENV=production npm run backfill:kr -- --dry-run
 *   DEPLOY_ENV=production npm run backfill:kr
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

const DATA_DIR = path.resolve(__dirname, "../../Backup/DB File/Ex Data");
const ITEMS_CSV = path.join(DATA_DIR, "items.csv");

/** Sample Korean shop names (only applied when supp_name_kr is empty). */
const SUPPLIER_KR_BY_CODE: Record<string, string> = {
  s0001: "망원 시장 채소 가게",
  s0002: "찰리 삼촌 채소 가게",
  s0003: "요 시장 채소 가게",
  s0004: "A씨 채소 가게 (온라인)",
  s0005: "B씨 채소 가게",
  s0006: "우성산 해산물 식당",
  s0007: "쌀가게",
  s0008: "망원 고기 가게",
  s0009: "마포 건조식품 가게",
  s0010: "파파야 가게",
  s0011: "탄산음료 가게",
  s0012: "소프트쉘 크랩 가게",
  s0013: "나일틸라피아 가게",
  s0014: "콩·건고추 가게",
  s0015: "고기 가게 2",
  s0016: "주류 가게",
  s0017: "테스트 매장",
};

/** Match unit_name_th (or Thai tail of legacy label) → Korean sample. */
const UNIT_KR_BY_TH: Record<string, string> = {
  กิโลกรัม: "킬로그램",
  กรัม: "그램",
  ถุง: "봉지",
  ชิ้น: "개",
  ขวด: "병",
  กระป๋อง: "캔",
  มิลลิลิตร: "밀리리터",
  ชุด: "세트",
  แพ็ค: "팩",
  กล่อง: "박스",
  ลิตร: "리터",
  ลูก: "개",
  ถัง: "통",
  ห่อ: "묶음",
  ฟอง: "알",
  โหล: "단지",
  ม้วน: "롤",
  แกลลอน: "갤런",
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseItemName(itemName: string) {
  const parts = itemName.split(" / ").map((p) => p.trim());
  return {
    th: parts[0] || itemName,
    en: parts[1] || "",
    kr: parts[2] || "",
  };
}

function loadItemKrFromCsv(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(ITEMS_CSV)) {
    console.warn("items.csv not found — item KR from CSV skipped");
    return map;
  }
  const raw = fs.readFileSync(ITEMS_CSV, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const codeIdx = headers.indexOf("itemCode");
  const nameIdx = headers.indexOf("itemName");
  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line);
    const code = vals[codeIdx]?.trim().toUpperCase();
    const name = vals[nameIdx] || "";
    if (!code) continue;
    const { kr } = parseItemName(name);
    if (kr.trim()) map.set(code, kr.trim());
  }
  return map;
}

function isEmptyKr(value: string | null | undefined): boolean {
  return !String(value ?? "").trim();
}

function thaiTailFromUnitLabel(label: string): string {
  const parts = String(label || "")
    .split("/")
    .map((p) => p.trim());
  const th = parts[parts.length - 1] || label;
  return th.trim();
}

function unitKrSample(label: string): string | null {
  const th = thaiTailFromUnitLabel(label);
  if (UNIT_KR_BY_TH[th]) return UNIT_KR_BY_TH[th];
  const en = label.split("/")[0]?.trim() || "";
  if (/kilogram/i.test(en)) return "킬로그램 (kg)";
  if (/^gram/i.test(en)) return "그램 (g)";
  if (/milliliter/i.test(en)) return "밀리리터 (ml)";
  if (/^bag\b/i.test(en)) return "봉지";
  if (/^piece/i.test(en)) return "개";
  if (/^bottle/i.test(en)) return "병";
  if (/^can\b/i.test(en)) return "캔";
  if (/^set\b/i.test(en)) return "세트";
  if (/^pack/i.test(en)) return "팩";
  if (/^box/i.test(en)) return "박스";
  if (/^jar/i.test(en)) return "병";
  return th ? `${th} (예시)` : null;
}

const ITEM_KR_OVERRIDES: Record<string, string> = {
  RM00179: "테스트 상품 1",
  RM00180: "테스트 상품 2",
  RM00181: "쌀국수 허브세트 (พริกไทยสยาม)",
};

/** Fallback when CSV has no KR: short sample from EN or TH. */
function itemKrFallback(code: string, nameTh: string, nameEn: string): string {
  const override = ITEM_KR_OVERRIDES[code.toUpperCase()];
  if (override) return override;
  const en = nameEn.trim();
  if (/product testing/i.test(en)) {
    const n = en.match(/\d+/)?.[0];
    return n ? `테스트 상품 ${n}` : "테스트 상품";
  }
  if (en) return en;
  const th = nameTh.trim();
  if (!th) return "";
  return `${th} (한글 예시)`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key);
  const itemKrCsv = loadItemKrFromCsv();

  const [{ data: items, error: iErr }, { data: suppliers, error: sErr }, { data: units, error: uErr }] =
    await Promise.all([
      sb.from("items").select("item_code, item_name_th, item_name_en, item_name_kr"),
      sb.from("suppliers").select("supp_code, supp_name, supp_name_kr"),
      sb.from("units").select("unit_code, display_name, unit_name_th, unit_name_en, unit_name_kr"),
    ]);
  if (iErr) throw iErr;
  if (sErr) throw sErr;
  if (uErr) throw uErr;

  let itemUpdates = 0;
  let suppUpdates = 0;
  let unitUpdates = 0;

  for (const row of items || []) {
    if (!isEmptyKr(row.item_name_kr)) continue;
    const code = String(row.item_code).toUpperCase();
    const kr =
      itemKrCsv.get(code) ||
      itemKrFallback(code, String(row.item_name_th), String(row.item_name_en));
    if (!kr.trim()) continue;
    itemUpdates++;
    console.log(`item ${code}: ${kr}`);
    if (!dryRun) {
      const { error } = await sb.from("items").update({ item_name_kr: kr }).eq("item_code", row.item_code);
      if (error) throw error;
    }
  }

  for (const row of suppliers || []) {
    if (!isEmptyKr(row.supp_name_kr)) continue;
    const code = String(row.supp_code).toLowerCase();
    const kr = SUPPLIER_KR_BY_CODE[code];
    if (!kr?.trim()) continue;
    suppUpdates++;
    console.log(`supplier ${code}: ${kr}`);
    if (!dryRun) {
      const { error } = await sb.from("suppliers").update({ supp_name_kr: kr }).eq("supp_code", row.supp_code);
      if (error) throw error;
    }
  }

  for (const row of units || []) {
    if (!isEmptyKr(row.unit_name_kr)) continue;
    const label = String(row.unit_name_th || row.display_name || "");
    const kr = unitKrSample(label);
    if (!kr) continue;
    unitUpdates++;
    console.log(`unit ${row.unit_code}: ${kr}`);
    if (!dryRun) {
      const { error } = await sb.from("units").update({ unit_name_kr: kr }).eq("unit_code", row.unit_code);
      if (error) throw error;
    }
  }

  console.log(
    `\n${dryRun ? "[dry-run] " : ""}Would update / updated: items=${itemUpdates}, suppliers=${suppUpdates}, units=${unitUpdates}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
