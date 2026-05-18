/**
 * Seed default PIN users. Run after migrations:
 *   npm run seed:pins
 */
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

loadDeployEnv();

const USERS = [
  {
    first_name: "พนักงาน",
    last_name: "รับของ",
    display_name: "พนักงานร้าน",
    email: "operator@amazing-nkh.local",
    role: "operator",
    pin: "1111",
  },
  {
    first_name: "แอดมิน",
    last_name: "ระบบ",
    display_name: "แอดมิน",
    email: "admin@amazing-nkh.local",
    role: "admin",
    pin: "2222",
  },
  {
    first_name: "ผู้จัดการ",
    last_name: "",
    display_name: "ผู้จัดการ",
    email: "manager@amazing-nkh.local",
    role: "manager",
    pin: "3333",
  },
] as const;

async function main() {
  const { url, key } = requireSupabaseEnv();

  const supabase = createClient(url, key);
  await supabase.from("app_users").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  for (const u of USERS) {
    const pin_hash = await bcrypt.hash(u.pin, 10);
    const { error } = await supabase.from("app_users").insert({
      first_name: u.first_name,
      last_name: u.last_name,
      display_name: u.display_name,
      email: u.email,
      pin_hash,
      role: u.role,
      active: true,
    });
    if (error) {
      console.error(`Failed ${u.role}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ ${u.role} (${u.display_name}) PIN: ${u.pin}`);
  }
  console.log("Done.");
}

main();
