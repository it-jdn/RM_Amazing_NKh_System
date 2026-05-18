import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const WEB_ROOT = path.resolve(__dirname, "..");

/** Load `.env.production.local` when DEPLOY_ENV=production, else `.env.local`. */
export function loadDeployEnv(): string {
  const production = process.env.DEPLOY_ENV === "production";
  const primary = production ? ".env.production.local" : ".env.local";
  const primaryPath = path.join(WEB_ROOT, primary);

  if (production && !fs.existsSync(primaryPath)) {
    throw new Error(
      `Missing ${primary}. Copy .env.production.example → .env.production.local and fill Supabase production credentials.`
    );
  }

  dotenv.config({ path: path.join(WEB_ROOT, ".env.example") });
  dotenv.config({ path: primaryPath, override: true });
  return primary;
}

export function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in deploy env file.");
  }
  return { url, key };
}
