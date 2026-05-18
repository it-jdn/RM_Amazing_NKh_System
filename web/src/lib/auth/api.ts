import { getSession, roleCanAccessApi } from "@/lib/auth/session";
import { forbidden, unauthorized } from "@/lib/api/response";
import type { SessionPayload } from "@/lib/types";

export async function requireSession(): Promise<
  { session: SessionPayload } | ReturnType<typeof unauthorized>
> {
  const session = await getSession();
  if (!session) return unauthorized();
  return { session };
}

export async function requireApiRole(pathname: string) {
  const result = await requireSession();
  if ("status" in result) return result;
  if (!roleCanAccessApi(pathname, result.session.role)) {
    return forbidden("ไม่มีสิทธิ์เข้าถึง");
  }
  return result;
}

export async function requireAdmin() {
  const result = await requireSession();
  if ("status" in result) return result;
  if (result.session.role !== "admin") {
    return forbidden("เฉพาะผู้ดูแลระบบเท่านั้น");
  }
  return result;
}
