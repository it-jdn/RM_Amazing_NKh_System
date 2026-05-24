import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { addSupplier } from "@/lib/services/data";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const result = await addSupplier(body.suppCode, {
      nameTH: body.suppNameTH || body.suppName || "",
      nameEN: body.suppNameEN,
      nameKR: body.suppNameKR,
      businessRegNo: body.suppBusinessRegNo,
    });
    if (!result.ok) return jsonError(result.message);
    return jsonOk({ success: true, message: result.message });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
