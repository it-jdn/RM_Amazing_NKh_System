import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDisplayName, sanitizeUserNamePart } from "@/lib/users/display-name";
import { mapUserRow, type AppUserRow } from "@/lib/users/db";
import { hashPin, validatePin } from "@/lib/users/pin";
import { assertPinUniqueInRole } from "@/lib/users/pin-uniqueness";
import type { AppRole } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;

  const { id } = await params;

  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const { data: existing, error: loadErr } = await supabase
      .from("app_users")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) return jsonError(loadErr.message, 500);
    if (!existing) return jsonError("ไม่พบผู้ใช้", 404);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.firstName !== undefined) {
      const firstName = sanitizeUserNamePart(String(body.firstName));
      if (!firstName) return jsonError("กรุณากรอกชื่อ");
      patch.first_name = firstName;
    }
    if (body.lastName !== undefined) {
      patch.last_name = sanitizeUserNamePart(String(body.lastName));
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!email) return jsonError("กรุณากรอกอีเมล");
      patch.email = email;
    }
    if (body.role !== undefined) {
      const role = body.role as AppRole;
      if (!["operator", "admin", "manager"].includes(role)) {
        return jsonError("บทบาทไม่ถูกต้อง");
      }
      patch.role = role;
    }
    if (body.active !== undefined) {
      patch.active = Boolean(body.active);
    }
    if (body.pin !== undefined && String(body.pin).trim()) {
      const newPin = String(body.pin).trim();
      const pinErr = validatePin(newPin);
      if (pinErr) return jsonError(pinErr);
      const targetRole = (patch.role as AppRole | undefined) ?? (existing.role as AppRole);
      const dupErr = await assertPinUniqueInRole(supabase, newPin, targetRole, id);
      if (dupErr) return jsonError(dupErr);
      patch.pin_hash = await hashPin(newPin);
    }

    if (patch.first_name !== undefined || patch.last_name !== undefined) {
      const { data: current } = await supabase
        .from("app_users")
        .select("first_name, last_name")
        .eq("id", id)
        .single();
      const first = sanitizeUserNamePart(
        String(patch.first_name ?? current?.first_name ?? "")
      );
      const last = sanitizeUserNamePart(
        String(patch.last_name ?? current?.last_name ?? "")
      );
      patch.display_name = buildDisplayName(first, last);
    }

    const { data, error } = await supabase
      .from("app_users")
      .update(patch)
      .eq("id", id)
      .select("id, display_name, first_name, last_name, email, role, active, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") return jsonError("อีเมลนี้ถูกใช้แล้ว");
      return jsonError(error.message, 500);
    }

    return jsonOk({
      success: true,
      message: "บันทึกข้อมูลผู้ใช้แล้ว",
      user: mapUserRow(data as AppUserRow),
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
