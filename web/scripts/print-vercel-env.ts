/**
 * Print env var names/values for Vercel (run locally, do not commit output).
 *   DEPLOY_ENV=production npm run deploy:print-vercel-env
 */
import { loadDeployEnv } from "./load-deploy-env";

loadDeployEnv();

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "TZ",
] as const;

console.log("Paste into Vercel → Project → Settings → Environment Variables (Production):\n");
for (const k of KEYS) {
  const v = process.env[k] ?? "";
  console.log(`${k}=${v}`);
}
