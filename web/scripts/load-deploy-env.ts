import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const WEB_ROOT = path.resolve(__dirname, "..");

const ENV_FILES: Record<string, string> = {
  production: ".env.production.local",
  staging: ".env.staging.local",
  local: ".env.local",
};

/** Load env file from DEPLOY_ENV: production | staging | local (default). */
export function loadDeployEnv(): string {
  const mode = (process.env.DEPLOY_ENV || "local").toLowerCase();
  const primary = ENV_FILES[mode] ?? ENV_FILES.local;
  const primaryPath = path.join(WEB_ROOT, primary);

  if ((mode === "production" || mode === "staging") && !fs.existsSync(primaryPath)) {
    const example = primary.replace(".local", ".example");
    throw new Error(
      `Missing ${primary}. Copy web/${example} → web/${primary} and fill credentials.`
    );
  }

  dotenv.config({ path: path.join(WEB_ROOT, ".env.example") });
  dotenv.config({ path: path.join(WEB_ROOT, ".env.local"), override: true });
  if (mode !== "local" && fs.existsSync(primaryPath)) {
    dotenv.config({ path: primaryPath, override: true });
  }

  return primaryPath;
}

export function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in deploy env file.");
  }
  return { url, key };
}
