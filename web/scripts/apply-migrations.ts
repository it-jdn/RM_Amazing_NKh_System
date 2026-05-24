/**
 * Apply SQL migrations in order (requires DATABASE_URL).
 *   npm run db:migrate
 *   DEPLOY_ENV=production npm run db:migrate
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";
import { loadDeployEnv } from "./load-deploy-env";

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");

/** Canonical order (matches README; seed_pins optional via --include-seed-pins). */
const MIGRATION_ORDER = [
  "001_init.sql",
  "002_transaction_audit.sql",
  "003_supplier_i18n.sql",
  "004_app_users_profile.sql",
  "005_units_and_mapping_config.sql",
  "006_units_i18n.sql",
  "007_supplier_sort_order.sql",
  "008_fix_gramma_unit.sql",
  "009_rename_operator_role_label.sql",
  "010_item_categories.sql",
  "011_supplier_item_purchase_units.sql",
  "012_item_purchase_units.sql",
  "013_intake_slips.sql",
] as const;

const OPTIONAL = ["002_seed_pins.sql"] as const;

async function main() {
  const envFile = loadDeployEnv();
  const includeSeedPins = process.argv.includes("--include-seed-pins");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      `DATABASE_URL is not set in ${envFile}.\n` +
        "Supabase → Project Settings → Database → Connection string (URI, session mode).\n" +
        "Or run migrations manually in SQL Editor (001 → 012, skip 002_seed_pins if using npm run seed:pins)."
    );
    process.exit(1);
  }

  const files: string[] = [...MIGRATION_ORDER];
  if (includeSeedPins) {
    files.splice(1, 0, "002_seed_pins.sql");
  }

  const sql = postgres(databaseUrl, { max: 1 });

  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  for (const filename of files) {
    const full = path.join(MIGRATIONS_DIR, filename);
    if (!fs.existsSync(full)) {
      console.error(`Missing migration file: ${filename}`);
      process.exit(1);
    }

    const [{ exists }] = await sql<{ exists: boolean }[]>`
      select exists(select 1 from schema_migrations where filename = ${filename}) as exists
    `;
    if (exists) {
      console.log(`skip ${filename} (already applied)`);
      continue;
    }

    const body = fs.readFileSync(full, "utf8");
    console.log(`apply ${filename}...`);
    await sql.unsafe(body);
    await sql`insert into schema_migrations (filename) values (${filename})`;
    console.log(`done ${filename}`);
  }

  if (!includeSeedPins) {
    console.log(`(skipped ${OPTIONAL.join(", ")} — use npm run seed:pins or --include-seed-pins)`);
  }

  await sql.end();
  console.log("\nAll migrations applied. Reload schema in Supabase → Settings → API if needed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
