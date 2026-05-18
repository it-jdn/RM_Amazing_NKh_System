#!/usr/bin/env node
/**
 * Migrate GRAMG (Gramma) -> GRAMG1 (กรัม), preserve convert_rate, delete GRAMG.
 * Usage: node scripts/fix-gramma-unit.mjs
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const BAD = "GRAMG";
const GOOD = "GRAMG1";
const GOOD_LABEL = "กรัม";
const sb = createClient(url, key);

async function countSub(code) {
  const { count, error } = await sb
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("sub_unit_code", code);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const { data: good } = await sb.from("units").select("*").eq("unit_code", GOOD).single();
  const { data: bad } = await sb.from("units").select("*").eq("unit_code", BAD).maybeSingle();
  if (!good) throw new Error(`Unit ${GOOD} not found`);
  if (!bad) {
    console.log("GRAMG already removed.");
    return;
  }

  console.log("Before: items with GRAMG =", await countSub(BAD));

  for (const [table, col] of [
    ["items", "sub_unit_code"],
    ["items", "main_unit_code"],
    ["supplier_item_mapping", "sub_unit_code"],
    ["supplier_item_mapping", "main_unit_code"],
  ]) {
    const { error } = await sb.from(table).update({ [col]: GOOD }).eq(col, BAD);
    if (error) throw error;
  }

  await sb.from("unit_pair_hints").update({ sub_unit_code: GOOD }).eq("sub_unit_code", BAD);
  await sb.from("unit_pair_hints").update({ main_unit_code: GOOD }).eq("main_unit_code", BAD);
  await sb
    .from("items")
    .update({ sub_unit: GOOD_LABEL })
    .eq("sub_unit_code", GOOD)
    .ilike("sub_unit", "%Gramma%");

  await sb
    .from("units")
    .update({
      usage_count_main: (good.usage_count_main ?? 0) + (bad.usage_count_main ?? 0),
      usage_count_sub: (good.usage_count_sub ?? 0) + (bad.usage_count_sub ?? 0),
    })
    .eq("unit_code", GOOD);

  const { error: delErr } = await sb.from("units").delete().eq("unit_code", BAD);
  if (delErr) throw delErr;

  console.log("After: items with GRAMG =", await countSub(BAD));
  console.log("Items with GRAMG1 =", await countSub(GOOD));
  console.log("Done — deleted unit GRAMG (Gramma).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
