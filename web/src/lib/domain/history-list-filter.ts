import { itemDisplayName } from "@/lib/i18n/item-name";
import type { Locale } from "@/lib/i18n/types";
import type { Item, TransactionRow } from "@/lib/types";

export function transactionMatchesHistoryCategory(
  txn: TransactionRow,
  categoryCode: string,
  items: Item[]
): boolean {
  if (!categoryCode) return true;
  const item = items.find((i) => i.code === txn.itemCode);
  return item?.categoryCode === categoryCode;
}

export function transactionMatchesHistoryItemSearch(
  txn: TransactionRow,
  query: string,
  items: Item[],
  locale: Locale
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const item = items.find((i) => i.code === txn.itemCode);
  const haystack = new Set<string>();
  const add = (value: string | undefined | null) => {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) haystack.add(trimmed);
  };

  add(txn.itemCode);
  add(txn.itemNameTH);
  add(item?.code);
  add(item?.nameTH);
  add(item?.nameEN);
  add(item?.nameKR);
  if (item) add(itemDisplayName(item, locale));

  return [...haystack].some((value) => value.includes(q));
}

export function filterHistoryTransactions(
  txns: TransactionRow[],
  filters: {
    categoryCode: string;
    itemSearch: string;
    itemCode: string;
    items: Item[];
    locale: Locale;
  }
): TransactionRow[] {
  const { categoryCode, itemSearch, itemCode, items, locale } = filters;
  if (!categoryCode && !itemSearch.trim() && !itemCode) return txns;

  return txns.filter((txn) => {
    if (!transactionMatchesHistoryCategory(txn, categoryCode, items)) return false;
    if (itemCode) return txn.itemCode === itemCode;
    return transactionMatchesHistoryItemSearch(txn, itemSearch, items, locale);
  });
}
