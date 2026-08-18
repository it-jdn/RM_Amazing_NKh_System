import { supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import type { Locale } from "@/lib/i18n/types";
import type { Supplier } from "@/lib/types";
import type { HistoryListGroup } from "@/lib/domain/history-list-groups";

export type HistoryListSortColumn =
  | "date"
  | "shop"
  | "lines"
  | "total"
  | "savedBy"
  | "savedAt"
  | "updatedAt";

export type HistoryListSortState = {
  column: HistoryListSortColumn;
  direction: "asc" | "desc";
};

export const DEFAULT_HISTORY_LIST_SORT: HistoryListSortState = {
  column: "date",
  direction: "desc",
};

export function toggleHistoryListSort(
  current: HistoryListSortState,
  column: HistoryListSortColumn
): HistoryListSortState {
  if (current.column === column) {
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  const defaultDesc = ["date", "lines", "total", "savedAt", "updatedAt"].includes(column);
  return { column, direction: defaultDesc ? "desc" : "asc" };
}

function compareNullableString(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function sortHistoryListGroups(
  groups: HistoryListGroup[],
  sort: HistoryListSortState,
  suppliers: Supplier[],
  locale: Locale
): HistoryListGroup[] {
  const dir = sort.direction === "asc" ? 1 : -1;

  return [...groups].sort((a, b) => {
    let cmp = 0;

    switch (sort.column) {
      case "date":
        cmp = String(a.date).localeCompare(String(b.date));
        break;
      case "shop": {
        const nameA = supplierDisplayNameByCode(a.suppCode, suppliers, locale, a.suppName);
        const nameB = supplierDisplayNameByCode(b.suppCode, suppliers, locale, b.suppName);
        cmp = nameA.localeCompare(nameB, locale);
        if (cmp === 0) cmp = a.suppCode.localeCompare(b.suppCode);
        break;
      }
      case "lines":
        cmp = a.count - b.count;
        break;
      case "total":
        cmp = a.total - b.total;
        break;
      case "savedBy": {
        const nameA = a.savedByName?.trim() || "";
        const nameB = b.savedByName?.trim() || "";
        cmp = nameA.localeCompare(nameB, locale);
        break;
      }
      case "savedAt":
        cmp = compareNullableString(a.savedAt, b.savedAt);
        break;
      case "updatedAt":
        cmp = compareNullableString(a.updatedAt, b.updatedAt);
        break;
    }

    if (cmp === 0) {
      cmp = String(b.date).localeCompare(String(a.date));
      if (cmp === 0) cmp = a.suppCode.localeCompare(b.suppCode);
      return cmp;
    }

    return cmp * dir;
  });
}
