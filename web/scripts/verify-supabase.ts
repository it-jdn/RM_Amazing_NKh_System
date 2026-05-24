/**
 * Verify Supabase connectivity and core tables.
 *   npm run deploy:verify
 *   DEPLOY_ENV=production npm run deploy:verify
 */
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

const TABLES = [
  "suppliers",
  "items",
  "item_purchase_units",
  "supplier_item_purchase_units",
  "transactions",
  "intake_slips",
  "app_users",
] as const;

async function main() {
  const envFile = loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key);

  console.log(`Env: ${envFile}`);
  console.log(`URL: ${url}\n`);

  let ok = true;
  for (const table of TABLES) {
    const { error, count } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`✗ ${table}: ${error.message}`);
      ok = false;
    } else {
      console.log(`✓ ${table}: ${count ?? 0} rows`);
    }
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.log("\n⚠ SESSION_SECRET missing or shorter than 32 chars (required on Vercel).");
    ok = false;
  } else {
    console.log("\n✓ SESSION_SECRET set");
  }

  if (!ok) process.exit(1);
  console.log("\nSupabase ready for deploy.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
