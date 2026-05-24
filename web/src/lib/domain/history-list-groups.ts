import { maxSavedAtFromRows } from "@/lib/domain/intake-slip";
import { latestTransactionAudit } from "@/lib/domain/transactions";
import type { IntakeSlipSummary, TransactionRow } from "@/lib/types";

export type HistoryListGroup = {
  date: string;
  suppCode: string;
  suppName: string;
  total: number;
  count: number;
  savedByName: string;
  savedAt: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
};

function earliestSavedFromRows(rows: TransactionRow[]): {
  savedAt: string | null;
  savedByName: string;
} {
  let savedAt: string | null = null;
  let savedByName = "";
  for (const row of rows) {
    const at = row.savedAt?.trim() || "";
    if (!at) continue;
    if (!savedAt || at < savedAt) {
      savedAt = at;
      savedByName = row.savedByName?.trim() || savedByName;
    }
  }
  return { savedAt, savedByName };
}

function slipWasEdited(slip: IntakeSlipSummary): boolean {
  if (slip.updatedAt && slip.createdAt && slip.updatedAt > slip.createdAt) return true;
  if (
    slip.updatedByUserId &&
    slip.createdByUserId &&
    slip.updatedByUserId !== slip.createdByUserId
  ) {
    return true;
  }
  return false;
}

function auditFromSlips(slips: IntakeSlipSummary[]): Pick<
  HistoryListGroup,
  "savedByName" | "savedAt" | "updatedAt" | "updatedByName"
> {
  const ordered = slips.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = ordered[0]!;
  let updatedAt: string | null = null;
  let updatedByName: string | null = null;

  for (const slip of slips) {
    if (!slipWasEdited(slip)) continue;
    if (!updatedAt || slip.updatedAt >= updatedAt) {
      updatedAt = slip.updatedAt;
      updatedByName = slip.updatedByName?.trim() || null;
    }
  }

  return {
    savedAt: first.createdAt,
    savedByName: first.createdByName?.trim() || "",
    updatedAt,
    updatedByName,
  };
}

function auditFromLegacyRows(rows: TransactionRow[]): Pick<
  HistoryListGroup,
  "savedByName" | "savedAt" | "updatedAt" | "updatedByName"
> {
  const earliest = earliestSavedFromRows(rows);
  const latest = latestTransactionAudit(rows);
  const maxAt = maxSavedAtFromRows(rows);

  let updatedAt: string | null = null;
  let updatedByName: string | null = null;
  if (
    earliest.savedAt &&
    maxAt &&
    maxAt > earliest.savedAt &&
    latest?.savedAt === maxAt
  ) {
    updatedAt = maxAt;
    updatedByName = latest.savedByName?.trim() || null;
  }

  return {
    savedAt: earliest.savedAt,
    savedByName: earliest.savedByName,
    updatedAt,
    updatedByName,
  };
}

export function buildHistoryListGroups(
  txns: TransactionRow[],
  slips: IntakeSlipSummary[]
): HistoryListGroup[] {
  const map = new Map<
    string,
    {
      date: string;
      suppCode: string;
      suppName: string;
      total: number;
      count: number;
      rows: TransactionRow[];
    }
  >();

  for (const txn of txns) {
    const key = `${txn.date}||${txn.suppCode}`;
    let group = map.get(key);
    if (!group) {
      group = {
        date: txn.date,
        suppCode: txn.suppCode,
        suppName: txn.suppName || txn.suppCode,
        total: 0,
        count: 0,
        rows: [],
      };
      map.set(key, group);
    }
    group.total += parseFloat(String(txn.totalPrice)) || 0;
    group.count += 1;
    group.rows.push(txn);
  }

  return [...map.values()].map((group) => {
    const groupSlips = slips.filter(
      (slip) => slip.date === group.date && slip.suppCode === group.suppCode
    );
    const audit =
      groupSlips.length > 0
        ? auditFromSlips(groupSlips)
        : auditFromLegacyRows(group.rows);

    return {
      date: group.date,
      suppCode: group.suppCode,
      suppName: group.suppName,
      total: group.total,
      count: group.count,
      ...audit,
    };
  });
}
