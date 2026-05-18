import { NextRequest } from "next/server";
import { requireAdmin, requireApiRole } from "@/lib/auth/api";
import { jsonOk, jsonError } from "@/lib/api/response";
import { createMasterUnit, listMasterUnits, listUnits } from "@/lib/services/units";
import type { UnitKind } from "@/lib/domain/units";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const result = await createMasterUnit({
      nameTH: String(body.nameTH || body.displayName || ""),
      nameEN: body.nameEN,
      nameKR: body.nameKR,
      unitCode: body.unitCode,
    });
    if (!result.ok) return jsonError(result.message);
    return jsonOk({ success: true, message: result.message, unit: result.unit });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function GET(req: Request) {
  const auth = await requireApiRole("/api/units");
  if ("status" in auth) return auth;

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") || "all") as UnitKind;
  if (!["main", "sub", "all"].includes(kind)) {
    return jsonError("Invalid kind", 400);
  }

  try {
    const units = kind === "all" ? await listMasterUnits() : await listUnits(kind);
    return jsonOk({ success: true, units });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
