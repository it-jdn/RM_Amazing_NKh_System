import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { formatPostgresError } from "@/lib/db/postgres-error";
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
    console.error("[api/data/initial]", e);
    return jsonError(formatPostgresError(e), 500);
  }
}
