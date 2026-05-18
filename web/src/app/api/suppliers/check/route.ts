import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { findSupplierByName } from "@/lib/services/data";

export async function GET(req: NextRequest) {
  const auth = await requireApiRole("/api/suppliers");
  if ("status" in auth) return auth;
  const url = new URL(req.url);
  const nameTH = url.searchParams.get("nameTH") || "";
  const nameEN = url.searchParams.get("nameEN") || "";
  const nameKR = url.searchParams.get("nameKR") || "";
  const excludeCode = url.searchParams.get("excludeCode") || undefined;
  if (!nameTH.trim()) return jsonError("nameTH required", 400);

  try {
    const dup = await findSupplierByName({ nameTH, nameEN, nameKR }, excludeCode);
    return jsonOk({
      success: true,
      duplicate: !!dup,
      existingName: dup ? String(dup.supp_name) : null,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
