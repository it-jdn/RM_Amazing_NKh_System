import { requireApiRole } from "@/lib/auth/api";
import { jsonOk, jsonError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { toDateStr } from "@/lib/domain/transactions";

export async function GET(req: Request) {
  const auth = await requireApiRole("/api/reports");
  if ("status" in auth) return auth;

  const url = new URL(req.url);
  const suppCode = url.searchParams.get("suppCode") || undefined;
  const itemCode = url.searchParams.get("itemCode") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  try {
    const supabase = createAdminClient();

    let priceQuery = supabase
      .from("mapping_price_history")
      .select("*")
      .order("recorded_at", { ascending: true });
    if (suppCode) priceQuery = priceQuery.eq("supp_code", suppCode);
    if (itemCode) priceQuery = priceQuery.eq("item_code", itemCode);

    let txnQuery = supabase
      .from("transactions")
      .select(
        "id, txn_date, supp_code, supp_name, item_code, item_name_th, qty, main_unit, sub_unit, convert_rate, unit_price, total_price, standard_unit_price_at_save"
      )
      .order("txn_date", { ascending: true });
    if (suppCode) txnQuery = txnQuery.eq("supp_code", suppCode);
    if (itemCode) txnQuery = txnQuery.eq("item_code", itemCode);
    if (dateFrom) txnQuery = txnQuery.gte("txn_date", dateFrom);
    if (dateTo) txnQuery = txnQuery.lte("txn_date", dateTo);

    const [{ data: priceHist, error: pErr }, { data: txns, error: tErr }] = await Promise.all([
      priceQuery,
      txnQuery,
    ]);
    if (pErr) throw pErr;
    if (tErr) throw tErr;

    const intakePoints = (txns || [])
      .filter((t) => (parseFloat(String(t.qty)) || 0) > 0)
      .map((t) => ({
        date: toDateStr(t.txn_date),
        suppCode: String(t.supp_code),
        suppName: String(t.supp_name),
        itemCode: String(t.item_code),
        itemNameTH: String(t.item_name_th),
        qty: parseFloat(String(t.qty)) || 0,
        mainUnit: String(t.main_unit || ""),
        subUnit: String(t.sub_unit || ""),
        convertRate: parseFloat(String(t.convert_rate)) || 1,
        unitPrice: parseFloat(String(t.unit_price)) || 0,
        standardPriceAtSave: parseFloat(String(t.standard_unit_price_at_save)) || null,
        totalPrice: parseFloat(String(t.total_price)) || 0,
        source: "intake" as const,
      }));

    return jsonOk({
      success: true,
      priceHistory: (priceHist || []).map((r) => ({
        id: r.id,
        suppCode: String(r.supp_code),
        itemCode: String(r.item_code),
        unitPrice: parseFloat(String(r.unit_price)) || 0,
        priceKind: String(r.price_kind),
        source: String(r.source),
        recordedAt: String(r.recorded_at),
        recordedBy: String(r.recorded_by || ""),
      })),
      intakePoints,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Error", 500);
  }
}
