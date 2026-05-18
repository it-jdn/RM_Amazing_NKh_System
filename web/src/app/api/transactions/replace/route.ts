import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/api";
import { jsonError, jsonOk } from "@/lib/api/response";
import { replaceTransactionsByDateSupp } from "@/lib/services/data";
import type { TransactionInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("status" in auth) return auth;
  try {
    const body = await req.json();
    const { date, suppCode, transactions } = body as {
      date: string;
      suppCode: string;
      transactions: TransactionInput[];
    };
    if (!date || !suppCode) return jsonError("ต้องระบุ date และ suppCode");
    const result = await replaceTransactionsByDateSupp(date, suppCode, transactions, {
      userId: auth.session.userId,
      displayName: auth.session.displayName,
    });
    if (!result.success) {
      return jsonError("message" in result && result.message ? result.message : "Error");
    }
    return jsonOk(result);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
