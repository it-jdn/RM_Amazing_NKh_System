import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getInitialData } from "@/lib/services/data";

export async function GET() {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const includeInactive =
      auth.session.role === "admin" || auth.session.role === "manager";
    const data = await getInitialData({ includeInactiveSuppliers: includeInactive });
    return jsonOk(data);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
