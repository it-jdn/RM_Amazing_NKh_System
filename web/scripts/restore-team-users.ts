/**
 * Restore the 4 JITDHANA team users (replaces seed demo users).
 *   DEPLOY_ENV=production npm run restore:team-users
 */
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";
import { hashPin, validatePin } from "../src/lib/users/pin";
import { buildDisplayName } from "../src/lib/users/display-name";
import type { AppRole } from "../src/lib/types";

/** Original team + unique PIN per user (managers must differ). */
const TEAM = [
  {
    first_name: "ฐนสิน",
    last_name: "ญาติสูงเนิน",
    email: "tanasin@jitdhana.com",
    role: "operator" as AppRole,
    pin: "1111",
  },
  {
    first_name: "IT",
    last_name: "JITDHANA",
    email: "it.jitdhana@gmail.com",
    role: "admin" as AppRole,
    pin: "2222",
  },
  {
    first_name: "คณพล",
    last_name: "วิสูเร",
    email: "kanapol@jitdhana.com",
    role: "manager" as AppRole,
    pin: "3331",
  },
  {
    first_name: "บารอกัต",
    last_name: "หวังเกษม",
    email: "it.jitdhana@jitdhana.com",
    role: "manager" as AppRole,
    pin: "3332",
  },
];

async function main() {
  loadDeployEnv();
  const { url, key } = requireSupabaseEnv();
  const supabase = createClient(url, key);

  for (const u of TEAM) {
    const pinErr = validatePin(u.pin);
    if (pinErr) throw new Error(`${u.email}: ${pinErr}`);
  }

  const managerPins = TEAM.filter((u) => u.role === "manager").map((u) => u.pin);
  if (new Set(managerPins).size !== managerPins.length) {
    throw new Error("Manager PINs must be unique");
  }

  const { data: existing } = await supabase.from("app_users").select("id");
  if (existing?.length) {
    const { error: delErr } = await supabase
      .from("app_users")
      .delete()
      .in(
        "id",
        existing.map((r) => r.id)
      );
    if (delErr) {
      console.error("Delete failed:", delErr.message);
      process.exit(1);
    }
  }

  for (const u of TEAM) {
    const pin_hash = await hashPin(u.pin);
    const display_name = buildDisplayName(u.first_name, u.last_name);
    const { error } = await supabase.from("app_users").insert({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      display_name,
      pin_hash,
      role: u.role,
      active: true,
    });
    if (error) {
      console.error(`Failed ${u.email}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ ${u.role} | ${display_name} | ${u.email} | PIN ${u.pin}`);
  }

  console.log("\nRestored 4 team users.");
}

main();
