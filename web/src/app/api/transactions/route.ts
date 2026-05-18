import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { getTransactions, saveIntakeSlip } from "@/lib/services/data";
import type { TransactionInput } from "@/lib/types";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      suppCode: searchParams.get("suppCode") || undefined,
    };
    return jsonOk(await getTransactions(filters));
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const transactions = body.transactions as TransactionInput[];
    const result = await saveIntakeSlip(transactions, {
      userId: auth.session.userId,
      displayName: auth.session.displayName,
    });
    if (!result.ok) return jsonError(result.message);
    return jsonOk({
      success: true,
      message: result.message,
      replaced: result.replaced === true,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
