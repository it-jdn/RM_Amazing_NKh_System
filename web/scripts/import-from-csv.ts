/**
 * Import master data from legacy CSV exports.
 *   npm run import:csv
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

loadDeployEnv();

const DATA_DIR = path.resolve(__dirname, "../../Backup/DB File/Ex Data");

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readCsv(file: string) {
  const raw = fs.readFileSync(file, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i] ?? "";
    });
    return obj;
  });
  return rows;
}

function parseItemName(itemName: string) {
  const parts = itemName.split(" / ").map((p) => p.trim());
  return {
    item_name_th: parts[0] || itemName,
    item_name_en: parts[1] || "",
    item_name_kr: parts[2] || "",
  };
}

async function main() {
  const { url, key } = requireSupabaseEnv();

  const supabase = createClient(url, key);

  const suppliersPath = path.join(DATA_DIR, "suppliers.csv");
  const itemsPath = path.join(DATA_DIR, "items.csv");
  const mappingPath = path.join(DATA_DIR, "mapping.csv");

  if (!fs.existsSync(suppliersPath)) {
    console.error("Missing:", suppliersPath);
    process.exit(1);
  }

  console.log("Importing suppliers...");
  const suppliers = readCsv(suppliersPath);
  const suppRows = suppliers.map((r) => ({
    supp_code: r.suppCode,
    supp_name: r.suppName,
    supp_name_en: r.suppNameEN || r.suppNameEn || "",
    supp_name_kr: r.suppNameKR || r.suppNameKr || "",
    active: String(r.active).toLowerCase() !== "false",
  }));
  const { error: sErr } = await supabase.from("suppliers").upsert(suppRows, { onConflict: "supp_code" });
  if (sErr) throw sErr;
  console.log(`  ${suppRows.length} suppliers`);

  console.log("Importing items...");
  const items = readCsv(itemsPath);
  const itemRows = items.map((r) => {
    const names =
      r.itemNameTH !== undefined
        ? {
            item_name_th: r.itemNameTH || "",
            item_name_en: r.itemNameEN || "",
            item_name_kr: r.itemNameKR || "",
          }
        : parseItemName(r.itemName || "");
    return {
      item_code: r.itemCode,
      ...names,
      main_unit: r.mainUnit,
      sub_unit: r.subUnit,
      convert_rate: parseFloat(r.convertRate) || 1,
    };
  });
  for (let i = 0; i < itemRows.length; i += 50) {
    const chunk = itemRows.slice(i, i + 50);
    const { error } = await supabase.from("items").upsert(chunk, { onConflict: "item_code" });
    if (error) throw error;
  }
  console.log(`  ${itemRows.length} items`);

  console.log("Importing mapping...");
  const mapping = readCsv(mappingPath);
  const mapRows = mapping.map((r) => ({
    supp_code: r.suppCode,
    item_code: r.itemCode,
    unit_price: parseFloat(r.unitPrice) || 0,
  }));
  for (let i = 0; i < mapRows.length; i += 50) {
    const chunk = mapRows.slice(i, i + 50);
    const { error } = await supabase.from("supplier_item_mapping").upsert(chunk, {
      onConflict: "supp_code,item_code",
    });
    if (error) throw error;
  }
  console.log(`  ${mapRows.length} mappings`);
  console.log("Import complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
