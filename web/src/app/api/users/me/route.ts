import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapUserRow, type AppUserRow } from "@/lib/users/db";
import { assertPinUniqueInRole } from "@/lib/users/pin-uniqueness";
import type { AppRole } from "@/lib/types";

export async function GET() {
  const auth = await requireSession();
  if ("status" in auth) return auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, display_name, first_name, last_name, email, role, active, created_at, updated_at")
    .eq("id", auth.session.userId)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("ไม่พบผู้ใช้", 404);

  return jsonOk({ user: mapUserRow(data as AppUserRow) });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;

  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const { data: row, error: loadErr } = await supabase
      .from("app_users")
      .select("pin_hash, role")
      .eq("id", auth.session.userId)
      .maybeSingle();

    if (loadErr) return jsonError(loadErr.message, 500);
    if (!row) return jsonError("ไม่พบผู้ใช้", 404);

    const newPin = String(body.newPin || "").trim();
    const confirmPin = String(body.confirmPin || "").trim();

    if (!newPin) return jsonError("กรุณากรอก PIN ใหม่");

    const { validatePin, hashPin, verifyPin } = await import("@/lib/users/pin");
    const pinErr = validatePin(newPin);
    if (pinErr) return jsonError(pinErr);
    if (newPin !== confirmPin) return jsonError("PIN ใหม่ไม่ตรงกัน");

    const currentPin = String(body.currentPin || "").trim();
    const hasExisting = Boolean(row.pin_hash);
    if (hasExisting) {
      if (!currentPin) return jsonError("กรุณากรอก PIN ปัจจุบัน");
      const ok = await verifyPin(currentPin, row.pin_hash);
      if (!ok) return jsonError("PIN ปัจจุบันไม่ถูกต้อง", 401);
    }

    const dupErr = await assertPinUniqueInRole(
      supabase,
      newPin,
      row.role as AppRole,
      auth.session.userId
    );
    if (dupErr) return jsonError(dupErr);

    const pin_hash = await hashPin(newPin);
    const { error } = await supabase
      .from("app_users")
      .update({ pin_hash, updated_at: new Date().toISOString() })
      .eq("id", auth.session.userId);

    if (error) return jsonError(error.message, 500);

    return jsonOk({
      success: true,
      message: hasExisting ? "เปลี่ยน PIN เรียบร้อย" : "ตั้ง PIN เรียบร้อย",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
