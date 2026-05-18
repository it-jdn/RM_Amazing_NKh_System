import { createAdminClient } from "@/lib/supabase/admin";

export async function recordItemVersion(
  itemCode: string,
  snapshot: {
    itemNameTH: string;
    itemNameEN: string;
    itemNameKR: string;
    mainUnit: string;
    subUnit: string;
    mainUnitCode?: string | null;
    subUnitCode?: string | null;
    convertRate: number;
  },
  audit?: { displayName: string; reason?: string }
) {
  const supabase = createAdminClient();
  const { data: latest } = await supabase
    .from("item_versions")
    .select("version")
    .eq("item_code", itemCode)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ? Number(latest.version) : 0) + 1;

  if (latest?.version) {
    await supabase
      .from("item_versions")
      .update({ valid_to: new Date().toISOString() })
      .eq("item_code", itemCode)
      .eq("version", latest.version);
  }

  const { error } = await supabase.from("item_versions").insert({
    item_code: itemCode,
    version: nextVersion,
    item_name_th: snapshot.itemNameTH,
    item_name_en: snapshot.itemNameEN,
    item_name_kr: snapshot.itemNameKR,
    main_unit: snapshot.mainUnit,
    sub_unit: snapshot.subUnit,
    main_unit_code: snapshot.mainUnitCode || null,
    sub_unit_code: snapshot.subUnitCode || null,
    convert_rate: snapshot.convertRate,
    changed_by: audit?.displayName || null,
    change_reason: audit?.reason || null,
  });
  if (error) throw error;
}

export async function recordMappingVersion(
  suppCode: string,
  itemCode: string,
  snapshot: {
    mainUnit: string;
    subUnit: string;
    mainUnitCode?: string | null;
    subUnitCode?: string | null;
    convertRate: number;
    standardUnitPrice: number;
    lastPurchaseUnitPrice?: number | null;
  },
  audit?: { displayName: string; reason?: string }
) {
  const supabase = createAdminClient();
  const { data: latest } = await supabase
    .from("supplier_item_mapping_versions")
    .select("version")
    .eq("supp_code", suppCode)
    .eq("item_code", itemCode)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ? Number(latest.version) : 0) + 1;

  if (latest?.version) {
    await supabase
      .from("supplier_item_mapping_versions")
      .update({ valid_to: new Date().toISOString() })
      .eq("supp_code", suppCode)
      .eq("item_code", itemCode)
      .eq("version", latest.version);
  }

  const { error } = await supabase.from("supplier_item_mapping_versions").insert({
    supp_code: suppCode,
    item_code: itemCode,
    version: nextVersion,
    main_unit: snapshot.mainUnit,
    sub_unit: snapshot.subUnit,
    main_unit_code: snapshot.mainUnitCode || null,
    sub_unit_code: snapshot.subUnitCode || null,
    convert_rate: snapshot.convertRate,
    standard_unit_price: snapshot.standardUnitPrice,
    last_purchase_unit_price: snapshot.lastPurchaseUnitPrice ?? null,
    changed_by: audit?.displayName || null,
    change_reason: audit?.reason || null,
  });
  if (error) throw error;
}

export async function insertMappingPriceHistory(entry: {
  suppCode: string;
  itemCode: string;
  unitPrice: number;
  priceKind: "standard" | "last_purchase";
  source: "manual" | "intake";
  txnId?: number | null;
  recordedBy?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("mapping_price_history").insert({
    supp_code: entry.suppCode,
    item_code: entry.itemCode,
    unit_price: entry.unitPrice,
    price_kind: entry.priceKind,
    source: entry.source,
    txn_id: entry.txnId ?? null,
    recorded_by: entry.recordedBy || null,
  });
  if (error) throw error;
}
