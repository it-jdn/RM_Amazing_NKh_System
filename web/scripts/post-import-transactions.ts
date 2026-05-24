/**
 * After historical append: backfill intake_slips + sync transaction_no_seq.
 *
 *   npm run import:post
 *   DEPLOY_ENV=production npm run import:post
 *
 * Uses DATABASE_URL when set; otherwise Supabase service role (backfill only).
 * setval still requires DATABASE_URL or manual SQL in Supabase SQL Editor.
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadDeployEnv, requireSupabaseEnv } from "./load-deploy-env";

const SQL_FILE = path.resolve(
  __dirname,
  "../supabase/manual-fixes/backfill_intake_slips_after_import.sql"
);

type TxRow = {
  id: string;
  txn_date: string;
  supp_code: string;
  supp_name: string | null;
  saved_at: string;
  saved_by_user_id: string | null;
  saved_by_name: string | null;
  note: string | null;
};

function groupKey(t: TxRow): string {
  const saved = String(t.saved_at).slice(0, 19).replace("T", " ");
  return `${t.txn_date}|${t.supp_code}|${saved}`;
}

async function fetchNullSlipTransactions(sb: SupabaseClient): Promise<TxRow[]> {
  const all: TxRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("transactions")
      .select(
        "id, txn_date, supp_code, supp_name, saved_at, saved_by_user_id, saved_by_name, note"
      )
      .is("slip_id", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as TxRow[];
    if (!page.length) break;
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function backfillViaSupabase(sb: SupabaseClient) {
  const rows = await fetchNullSlipTransactions(sb);
  console.log(`Transactions without slip_id: ${rows.length}`);
  if (!rows.length) return;

  const groups = new Map<string, TxRow[]>();
  for (const r of rows) {
    const k = groupKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  console.log(`Creating ${groups.size} intake slip(s)...`);
  let linked = 0;

  for (const [, batch] of groups) {
    const first = batch[0]!;
    const savedAt = String(first.saved_at).slice(0, 19).replace("T", " ");
    const slipNote =
      batch.map((x) => (x.note || "").trim()).find((n) => n.length > 0) || "";
    const savedByUserId = batch.find((x) => x.saved_by_user_id)?.saved_by_user_id;
    const savedByName =
      batch.map((x) => (x.saved_by_name || "").trim()).find((n) => n.length > 0) ||
      "";

    const { data: slip, error: insErr } = await sb
      .from("intake_slips")
      .insert({
        txn_date: first.txn_date,
        supp_code: first.supp_code,
        supp_name: first.supp_name || "",
        slip_note: slipNote,
        created_at: savedAt,
        created_by_user_id: savedByUserId,
        created_by_name: savedByName,
        updated_at: savedAt,
        updated_by_user_id: savedByUserId,
        updated_by_name: savedByName,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const ids = batch.map((x) => x.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error: upErr } = await sb
        .from("transactions")
        .update({ slip_id: slip.id })
        .in("id", chunk);
      if (upErr) throw upErr;
    }
    linked += batch.length;
    process.stdout.write(`  linked ${linked} / ${rows.length}\r`);
  }
  console.log(`\n✓ Linked ${linked} transactions to slips`);
}

async function reportCounts(sb: SupabaseClient) {
  const [{ count: slips }, { count: linked }, { data: maxRow }] = await Promise.all([
    sb.from("intake_slips").select("*", { count: "exact", head: true }),
    sb
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .not("slip_id", "is", null),
    sb.from("transactions").select("no").order("no", { ascending: false }).limit(1),
  ]);
  const maxNo = maxRow?.[0]?.no ?? 0;
  console.log(`  intake_slips: ${slips ?? 0}`);
  console.log(`  transactions with slip_id: ${linked ?? 0}`);
  console.log(`  max(transaction.no): ${maxNo}`);
  return maxNo;
}

async function main() {
  const envFile = loadDeployEnv();
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const body = fs.readFileSync(SQL_FILE, "utf8");
    const sql = postgres(databaseUrl, { max: 1 });
    const [{ count: nullSlips }] = await sql<{ count: number }[]>`
      select count(*)::int as count from transactions where slip_id is null
    `;
    console.log(`Transactions without slip_id: ${nullSlips}`);
    console.log("Running backfill_intake_slips_after_import.sql...");
    await sql.unsafe(body);
    const [{ max_no: maxNo }] = await sql<{ max_no: number }[]>`
      select coalesce(max(no), 0)::int as max_no from transactions
    `;
    const [{ slips }] = await sql<{ slips: number }[]>`
      select count(*)::int as slips from intake_slips
    `;
    const [{ linked }] = await sql<{ linked: number }[]>`
      select count(*)::int as linked from transactions where slip_id is not null
    `;
    console.log(`\n✓ Done`);
    console.log(`  intake_slips: ${slips}`);
    console.log(`  transactions with slip_id: ${linked}`);
    console.log(`  max(transaction.no): ${maxNo}`);
    console.log(`  transaction_no_seq synced via setval in SQL file`);
    await sql.end();
    return;
  }

  console.log(`No DATABASE_URL in ${envFile} — using Supabase API for backfill.`);
  const { url, key } = requireSupabaseEnv();
  const sb = createClient(url, key);

  await backfillViaSupabase(sb);
  const maxNo = await reportCounts(sb);

  console.log(
    `\n⚠ Run this in Supabase SQL Editor to sync transaction_no_seq:\n` +
      `SELECT setval('transaction_no_seq', ${Math.max(Number(maxNo) || 0, 1)});`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
