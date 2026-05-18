/**
 * Reset PIN for existing users only (does not delete users).
 *
 *   DEPLOY_ENV=production npm run reset:user-pins -- email1:pin1 email2:pin2
 *   DEPLOY_ENV=production npm run reset:user-pins -- --file scripts/team-pins.json
 *
 * JSON file format: [{ "email": "a@b.com", "pin": "1234" }, ...]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";
import { hashPin, validatePin } from "../src/lib/users/pin";
import { assertPinUniqueInRole } from "../src/lib/users/pin-uniqueness";
import type { AppRole } from "../src/lib/types";

type PinEntry = { email: string; pin: string };

function parseArgs(): PinEntry[] {
  const args = process.argv.slice(2);
  if (args[0] === "--file") {
    const file = path.resolve(process.cwd(), args[1] || "");
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as PinEntry[];
    return raw;
  }
  return args.map((pair) => {
    const i = pair.indexOf(":");
    if (i < 1) throw new Error(`Invalid pair "${pair}" — use email:pin`);
    return { email: pair.slice(0, i).trim().toLowerCase(), pin: pair.slice(i + 1).trim() };
  });
}

async function main() {
  const entries = parseArgs();
  if (!entries.length) {
    console.error("Usage: npm run reset:user-pins -- email:pin [email:pin ...]");
    console.error("   or: npm run reset:user-pins -- --file team-pins.json");
    process.exit(1);
  }

  loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const supabase = createClient(url, key);

  const pinsByRole = new Map<AppRole, string[]>();

  for (const { email, pin } of entries) {
    const pinErr = validatePin(pin);
    if (pinErr) {
      console.error(`${email}: ${pinErr}`);
      process.exit(1);
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, email, role, first_name, last_name")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error(email, error.message);
      process.exit(1);
    }
    if (!user) {
      console.error(`✗ ไม่พบผู้ใช้: ${email}`);
      process.exit(1);
    }

    const role = user.role as AppRole;
    const rolePins = pinsByRole.get(role) || [];
    if (rolePins.includes(pin)) {
      console.error(`✗ PIN ซ้ำใน role ${role} ภายในไฟล์/คำสั่งนี้: ${pin}`);
      process.exit(1);
    }
    rolePins.push(pin);
    pinsByRole.set(role, rolePins);

    const dupErr = await assertPinUniqueInRole(supabase, pin, role, user.id);
    if (dupErr) {
      console.error(`✗ ${email}: ${dupErr}`);
      process.exit(1);
    }

    const pin_hash = await hashPin(pin);
    const { error: updErr } = await supabase
      .from("app_users")
      .update({ pin_hash, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (updErr) {
      console.error(email, updErr.message);
      process.exit(1);
    }

    const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
    console.log(`✓ ${role} | ${name || email} | ${email} → PIN ${pin}`);
  }

  console.log("\nDone. (users kept — PIN only)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
