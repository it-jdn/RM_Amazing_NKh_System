import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { COOKIE_NAME, MAX_AGE, createSessionToken } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import type { AppRole } from "@/lib/types";
import { buildDisplayName } from "@/lib/users/display-name";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = String(body.pin || "").trim();
    const role = body.role as AppRole | undefined;

    if (!pin || pin.length < 4) {
      return jsonError("กรุณากรอก PIN อย่างน้อย 4 หลัก");
    }

    const supabase = createAdminClient();
    let query = supabase.from("app_users").select("*").eq("active", true);
    if (role) query = query.eq("role", role);

    const { data: users, error } = await query;
    if (error) throw error;

    let matched = null;
    for (const u of users || []) {
      const ok = await bcrypt.compare(pin, u.pin_hash);
      if (ok) {
        matched = u;
        break;
      }
    }

    if (!matched) {
      return jsonError("PIN ไม่ถูกต้อง", 401);
    }

    const displayName =
      buildDisplayName(String(matched.first_name || ""), String(matched.last_name || "")) ||
      matched.display_name;

    const token = await createSessionToken({
      userId: matched.id,
      displayName,
      role: matched.role as AppRole,
    });

    const res = jsonOk({
      success: true,
      displayName,
      role: matched.role,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return jsonError(msg, 500);
  }
}
