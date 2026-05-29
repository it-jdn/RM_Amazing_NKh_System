import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  COOKIE_NAME,
  MAX_AGE,
  createSessionToken,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapUserRow, type AppUserRow } from "@/lib/users/db";
import { buildDisplayName } from "@/lib/users/display-name";
import { assertPinUniqueInRole } from "@/lib/users/pin-uniqueness";
import {
  buildSelfProfilePatch,
  withDisplayNameFromNameParts,
} from "@/lib/users/self-profile-patch";
import type { AppRole, SessionPayload } from "@/lib/types";

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

function hasProfileFields(body: Record<string, unknown>) {
  return (
    body.firstName !== undefined ||
    body.lastName !== undefined ||
    body.email !== undefined
  );
}

function hasPinChange(body: Record<string, unknown>) {
  return String(body.newPin || "").trim() !== "";
}

async function refreshSessionCookie(
  res: NextResponse,
  session: SessionPayload
): Promise<void> {
  const token = await createSessionToken(session);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;

  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const { data: row, error: loadErr } = await supabase
      .from("app_users")
      .select("pin_hash, role, first_name, last_name, display_name")
      .eq("id", auth.session.userId)
      .maybeSingle();

    if (loadErr) return jsonError(loadErr.message, 500);
    if (!row) return jsonError("ไม่พบผู้ใช้", 404);

    const profileChange = hasProfileFields(body);
    const pinChange = hasPinChange(body);

    if (!profileChange && !pinChange) {
      return jsonError("ไม่มีข้อมูลที่จะบันทึก");
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (profileChange) {
      const { patch: profilePatch, error: profileErr } = buildSelfProfilePatch(body);
      if (profileErr) return jsonError(profileErr);
      Object.assign(
        patch,
        withDisplayNameFromNameParts(profilePatch, {
          first_name: row.first_name,
          last_name: row.last_name,
        })
      );
    }

    if (pinChange) {
      const newPin = String(body.newPin || "").trim();
      const confirmPin = String(body.confirmPin || "").trim();

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

      patch.pin_hash = await hashPin(newPin);
    }

    const { data, error } = await supabase
      .from("app_users")
      .update(patch)
      .eq("id", auth.session.userId)
      .select("id, display_name, first_name, last_name, email, role, active, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") return jsonError("อีเมลนี้ถูกใช้แล้ว");
      return jsonError(error.message, 500);
    }

    const user = mapUserRow(data as AppUserRow);
    const messages: string[] = [];
    if (profileChange) messages.push("บันทึกข้อมูลส่วนตัวแล้ว");
    if (pinChange) {
      messages.push(Boolean(row.pin_hash) ? "เปลี่ยน PIN เรียบร้อย" : "ตั้ง PIN เรียบร้อย");
    }

    const res = jsonOk({
      success: true,
      message: messages.join(" · "),
      user: profileChange ? user : undefined,
    });

    if (profileChange) {
      const displayName =
        user.displayName ||
        buildDisplayName(user.firstName, user.lastName) ||
        String(row.display_name || "");
      await refreshSessionCookie(res, {
        userId: auth.session.userId,
        displayName,
        role: auth.session.role,
      });
    }

    return res;
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
