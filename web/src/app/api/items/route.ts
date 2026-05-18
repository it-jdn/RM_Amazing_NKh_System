import { NextRequest } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { addNewItemToSupplier } from "@/lib/services/data";

export async function POST(req: NextRequest) {
  const auth = await requireApiRole("/api/items");
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const result = await addNewItemToSupplier(body);
    if (!result.ok) return jsonError(result.message);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
