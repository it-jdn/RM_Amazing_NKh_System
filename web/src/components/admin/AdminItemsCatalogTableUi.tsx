"use client";

import type { ItemsCatalogSortKey } from "@/lib/admin/items-catalog-list";

export function ItemShopChips(props: { names: string[]; emptyLabel: string; max?: number }) {
  const max = props.max ?? 3;
  if (!props.names.length) {
    return <span className="admin-item-shop-chips__empty">{props.emptyLabel}</span>;
  }
  const shown = props.names.slice(0, max);
  const rest = props.names.length - shown.length;
  return (
    <div className="admin-item-shop-chips" title={props.names.join(" · ")}>
      {shown.map((name) => (
        <span key={name} className="admin-item-shop-chip">
          {name}
        </span>
      ))}
      {rest > 0 ? (
        <span className="admin-item-shop-chip admin-item-shop-chip--more">+{rest}</span>
      ) : null}
    </div>
  );
}

export function AdminItemsCatalogSortTh(props: {
  label: string;
  column: ItemsCatalogSortKey;
  sortKey: ItemsCatalogSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: ItemsCatalogSortKey) => void;
  className?: string;
}) {
  const active = props.sortKey === props.column;
  return (
    <th className={props.className}>
      <button
        type="button"
        className={`admin-table-sort${active ? ` admin-table-sort--active admin-table-sort--${props.sortDir}` : ""}`}
        onClick={() => props.onSort(props.column)}
        aria-sort={active ? (props.sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{props.label}</span>
        <span className="admin-table-sort__icon" aria-hidden>
          {active ? (props.sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}
