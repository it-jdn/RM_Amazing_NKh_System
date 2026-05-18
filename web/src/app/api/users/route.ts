import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDisplayName, sanitizeUserNamePart } from "@/lib/users/display-name";
import { mapUserRow, type AppUserRow } from "@/lib/users/db";
import { hashPin, validatePin } from "@/lib/users/pin";
import type { AppRole } from "@/lib/types";

export async function GET() {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, display_name, first_name, last_name, email, role, active, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message, 500);

  return jsonOk({
    users: (data as AppUserRow[]).map(mapUserRow),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  try {
    const body = await req.json();
    const firstName = sanitizeUserNamePart(String(body.firstName || ""));
    const lastName = sanitizeUserNamePart(String(body.lastName || ""));
    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role as AppRole;
    const pin = String(body.pin || "").trim();
    const active = body.active !== false;

    if (!firstName || !email) {
      return jsonError("กรุณากรอกชื่อและอีเมล");
    }
    if (!["operator", "admin", "manager"].includes(role)) {
      return jsonError("บทบาทไม่ถูกต้อง");
    }
    const pinErr = validatePin(pin);
    if (pinErr) return jsonError(pinErr);

    const pin_hash = await hashPin(pin);
    const display_name = buildDisplayName(firstName, lastName);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_users")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        display_name,
        pin_hash,
        role,
        active,
      })
      .select("id, display_name, first_name, last_name, email, role, active, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") return jsonError("อีเมลนี้ถูกใช้แล้ว");
      return jsonError(error.message, 500);
    }

    return jsonOk({
      success: true,
      message: "สร้างผู้ใช้เรียบร้อย",
      user: mapUserRow(data as AppUserRow),
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
