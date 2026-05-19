import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getIntakeSlipMeta, getIntakeSlipMetaById } from "@/lib/services/data";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const slipId = searchParams.get("slipId")?.trim();
    if (slipId) {
      const meta = await getIntakeSlipMetaById(slipId);
      return jsonOk({ success: true, ...meta });
    }
    const date = searchParams.get("date")?.trim();
    const suppCode = searchParams.get("suppCode")?.trim();
    if (!date || !suppCode) {
      return jsonError("ต้องระบุ slipId หรือ date และ suppCode");
    }
    const meta = await getIntakeSlipMeta(date, suppCode);
    return jsonOk({ success: true, ...meta });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
