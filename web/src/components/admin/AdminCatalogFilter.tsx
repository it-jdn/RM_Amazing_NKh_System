"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import { sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { Supplier } from "@/lib/types";

export function AdminCatalogFilter(props: {
  suppliers: Supplier[];
  value: string;
  onChange: (shopCode: string) => void;
  count: number;
  search?: string;
  onSearchChange?: (query: string) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
}) {
  const { locale, t } = useLocale();
  const sorted = useMemo(
    () => sortSuppliersForPicker(props.suppliers.filter((s) => s.active !== false)),
    [props.suppliers]
  );
  const showSearch = props.onSearchChange !== undefined;

  return (
    <div className="admin-catalog-filter">
      <div className="admin-catalog-filter__row">
        {showSearch && (
          <div className="admin-catalog-filter__field admin-catalog-filter__field--search">
            <label className="lbl" htmlFor="admin-catalog-filter-search">
              {props.searchLabel ?? "Search"}
            </label>
            <input
              id="admin-catalog-filter-search"
              type="search"
              value={props.search ?? ""}
              onChange={(e) => props.onSearchChange!(e.target.value)}
              placeholder={props.searchPlaceholder}
              autoComplete="off"
            />
          </div>
        )}
        <div className="admin-catalog-filter__field">
          <label className="lbl" htmlFor="admin-catalog-filter-shop">
            {t("admin.catalog.filterLabel")}
          </label>
          <select
            id="admin-catalog-filter-shop"
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
          >
            <option value="">{t("admin.catalog.filterAll")}</option>
            {sorted.map((s) => (
              <option key={s.code} value={s.code}>
                {supplierDisplayName(s, locale)}
              </option>
            ))}
          </select>
        </div>
        <p className="admin-hint admin-catalog-filter__count">
          {t("admin.catalog.filterCount").replace("{n}", String(props.count))}
        </p>
      </div>
    </div>
  );
}
