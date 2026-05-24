/**
 * Export row counts + manifest for backup verification (no PII dump).
 *
 *   npm run export:db
 *   DEPLOY_ENV=production npm run export:db -- --out=../../Backup/snapshots
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

const TABLES = [
  "suppliers",
  "items",
  "supplier_item_mapping",
  "item_purchase_units",
  "supplier_item_purchase_units",
  "transactions",
  "intake_slips",
  "app_users",
] as const;

async function main() {
  loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const deployEnv = process.env.DEPLOY_ENV || "local";
  const outArg = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];
  const outDir = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.resolve(__dirname, "../../Backup/snapshots");

  const sb = createClient(url, key);
  const counts: Record<string, number | null> = {};
  let ok = true;

  for (const table of TABLES) {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      counts[table] = null;
      console.log(`✗ ${table}: ${error.message}`);
      ok = false;
    } else {
      counts[table] = count ?? 0;
      console.log(`✓ ${table}: ${count ?? 0}`);
    }
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    deployEnv,
    supabaseUrl: url.replace(/\/\/[^@]+@/, "//***@"),
    counts,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const file = path.join(outDir, `snapshot_${deployEnv}_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${file}`);

  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
