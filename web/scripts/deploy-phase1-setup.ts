/**
 * Phase 1 production DB setup (local machine → Supabase production).
 *   DEPLOY_ENV=production npm run deploy:setup
 *
 * Steps: verify → migrate (if DATABASE_URL) → seed:pins → import:csv
 * Optional: npm run deploy:setup -- --import-transactions
 */
import { spawnSync } from "child_process";
import path from "path";

const WEB_ROOT = path.resolve(__dirname, "..");

function run(script: string, extraArgs: string[] = []) {
  const env = { ...process.env, DEPLOY_ENV: process.env.DEPLOY_ENV || "production" };
  const r = spawnSync("npm", ["run", script, ...extraArgs], {
    cwd: WEB_ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  if (process.env.DEPLOY_ENV !== "production") {
    console.log("Using DEPLOY_ENV=production (set explicitly to override).\n");
    process.env.DEPLOY_ENV = "production";
  }

  run("deploy:verify");

  if (process.env.DATABASE_URL) {
    run("db:migrate");
  } else {
    console.log(
      "\n⚠ DATABASE_URL not set — skipping db:migrate.\n" +
        "  Run migrations in Supabase SQL Editor (001→012) then re-run deploy:setup.\n"
    );
  }

  run("seed:pins");
  run("import:csv");

  if (process.argv.includes("--import-transactions")) {
    run("import:transactions");
  }

  console.log("\nPhase 1 DB setup complete. Next: push to GitHub and deploy on Vercel.");
}

main();
