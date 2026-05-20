import type { IntakeRowVals } from "@/lib/domain/intake-row-draft";
import { itemDisplayName } from "@/lib/i18n/item-name";
import type { Locale } from "@/lib/i18n/types";
import type { Item } from "@/lib/types";

export type IntakeItemSortColumn = "name" | "code" | "qty" | "unit" | "total" | "sub";

export type IntakeItemSortState = {
  column: IntakeItemSortColumn;
  direction: "asc" | "desc";
};

export const DEFAULT_INTAKE_ITEM_SORT: IntakeItemSortState = {
  column: "name",
  direction: "asc",
};

export type IntakeSortableItem = Item & { rowKey: string };

function sortLocaleCollator(locale: Locale): Intl.Collator {
  const tag = locale === "kr" ? "ko" : locale === "en" ? "en" : "th";
  return new Intl.Collator(tag, { sensitivity: "base", numeric: true });
}

export function sortIntakeItems<T extends IntakeSortableItem>(
  items: T[],
  sort: IntakeItemSortState,
  locale: Locale,
  rowVals: IntakeRowVals
): T[] {
  const mult = sort.direction === "asc" ? 1 : -1;
  const coll = sortLocaleCollator(locale);
  const codeColl = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const cmp = (a: T, b: T): number => {
    let n = 0;
    switch (sort.column) {
      case "name": {
        n = coll.compare(itemDisplayName(a, locale), itemDisplayName(b, locale));
        break;
      }
      case "code": {
        n = codeColl.compare(a.code, b.code);
        break;
      }
      case "qty": {
        const qa = parseFloat(rowVals[a.rowKey]?.qty) || 0;
        const qb = parseFloat(rowVals[b.rowKey]?.qty) || 0;
        n = qa - qb;
        break;
      }
      case "total": {
        const ta = parseFloat(rowVals[a.rowKey]?.total) || 0;
        const tb = parseFloat(rowVals[b.rowKey]?.total) || 0;
        n = ta - tb;
        break;
      }
      case "unit": {
        n = coll.compare(String(a.unit), String(b.unit));
        break;
      }
      case "sub": {
        const subCmp = coll.compare(String(a.subUnit), String(b.subUnit));
        if (subCmp !== 0) n = subCmp;
        else n = a.convertRate - b.convertRate;
        break;
      }
      default:
        n = 0;
    }
    if (n !== 0) return mult * n;
    return codeColl.compare(a.code, b.code);
  };

  return [...items].sort(cmp);
}
