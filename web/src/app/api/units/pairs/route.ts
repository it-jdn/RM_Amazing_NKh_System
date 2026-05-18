import { requireApiRole } from "@/lib/auth/api";
import { jsonOk, jsonError } from "@/lib/api/response";
import { listUnitPairs } from "@/lib/services/units";

export async function GET(req: Request) {
  const auth = await requireApiRole("/api/units");
  if ("status" in auth) return auth;

  const url = new URL(req.url);
  const itemCode = url.searchParams.get("itemCode") || undefined;
  const suppCode = url.searchParams.get("suppCode") || undefined;
  const mainUnitCode = url.searchParams.get("mainUnitCode") || undefined;

  try {
    const pairs = await listUnitPairs({ itemCode, suppCode, mainUnitCode });
    return jsonOk({ success: true, pairs });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
