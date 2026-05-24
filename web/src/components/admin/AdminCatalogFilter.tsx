"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { itemCategoryDisplayName } from "@/lib/catalog/item-categories";
import { ITEM_FILTER_UNLINKED } from "@/lib/domain/item-filter";
import { sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import type { ItemCategory } from "@/lib/types";
import type { Supplier } from "@/lib/types";
import { IconX } from "@/components/icons/AppIcons";

type PickerOption = { value: string; label: string };
type ExtraSuggestionOption = PickerOption & { suggestLabel?: string };

function AdminFilterChipPicker(props: {
  id: string;
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: PickerOption[];
  /** Dropdown-only options; when active, shown as a pill above the input (not inside the box). */
  extraSuggestions?: ExtraSuggestionOption[];
  resolveQuery: (query: string) => string | null;
  chipLabel: (value: string) => string;
}) {
  const { t } = useLocale();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${props.id}-list`;

  const selected = useMemo(() => new Set(props.values), [props.values]);
  const hiddenInBox = useMemo(
    () => new Set((props.extraSuggestions ?? []).map((o) => o.value)),
    [props.extraSuggestions]
  );
  const chipValues = useMemo(
    () => props.values.filter((v) => !hiddenInBox.has(v)),
    [props.values, hiddenInBox]
  );
  const activeExtras = useMemo(
    () => (props.extraSuggestions ?? []).filter((o) => selected.has(o.value)),
    [props.extraSuggestions, selected]
  );

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const extras = (props.extraSuggestions ?? [])
      .filter((o) => !selected.has(o.value))
      .map((o) => ({ value: o.value, label: o.suggestLabel ?? o.label }));
    const shops = props.options.filter((o) => !selected.has(o.value));
    const pool = [...extras, ...shops];
    if (!q) return pool.slice(0, 12);
    return pool
      .filter(
        (o) =>
          o.value.toLowerCase().includes(q) ||
          o.label.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [draft, props.options, props.extraSuggestions, selected]);

  const addValue = useCallback(
    (value: string) => {
      if (!value || selected.has(value)) return;
      props.onChange([...props.values, value]);
      setDraft("");
      setOpen(false);
      inputRef.current?.focus();
    },
    [props, selected]
  );

  const removeValue = useCallback(
    (value: string) => {
      props.onChange(props.values.filter((v) => v !== value));
    },
    [props]
  );

  function commitDraft() {
    const resolved = props.resolveQuery(draft);
    if (resolved) addValue(resolved);
    else setDraft("");
  }

  const hasFilters = chipValues.length > 0 || activeExtras.length > 0;

  return (
    <div className="admin-catalog-filter__field">
      <label className="lbl" htmlFor={props.id}>
        {props.label}
      </label>
      {activeExtras.length ? (
        <div className="admin-catalog-filter__active-pills">
          {activeExtras.map((o) => (
            <span key={o.value} className="admin-catalog-filter__active-pill">
              <span>{o.suggestLabel ?? o.label}</span>
              <button
                type="button"
                className="admin-catalog-filter__active-pill-remove"
                onClick={() => removeValue(o.value)}
                aria-label={t("admin.catalog.removeChip")}
              >
                <IconX size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="admin-catalog-filter__picker">
        <div
          className={`admin-catalog-filter__chip-box${open ? " admin-catalog-filter__chip-box--open" : ""}`}
          onClick={() => inputRef.current?.focus()}
        >
          {chipValues.map((value) => (
            <span key={value} className="admin-catalog-filter__chip">
              <span className="admin-catalog-filter__chip-text">{props.chipLabel(value)}</span>
              <button
                type="button"
                className="admin-catalog-filter__chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeValue(value);
                }}
                aria-label={t("admin.catalog.removeChip")}
              >
                <IconX size={14} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            id={props.id}
            type="text"
            className="admin-catalog-filter__chip-input"
            value={draft}
            placeholder={hasFilters ? "" : props.placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={open && suggestions.length ? listId : undefined}
            aria-autocomplete="list"
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (suggestions.length === 1) addValue(suggestions[0].value);
                else commitDraft();
              } else if (e.key === "Backspace" && !draft && chipValues.length) {
                removeValue(chipValues[chipValues.length - 1]!);
              } else if (e.key === "Escape") {
                setOpen(false);
                setDraft("");
              }
            }}
          />
        </div>
        {open && suggestions.length ? (
          <ul id={listId} className="admin-catalog-filter__suggest" role="listbox">
            {suggestions.map((o) => (
              <li key={o.value} role="option">
                <button
                  type="button"
                  className="admin-catalog-filter__suggest-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addValue(o.value)}
                >
                  <span className="admin-catalog-filter__suggest-label">{o.label}</span>
                  {o.value !== o.label && !o.value.startsWith("__") ? (
                    <span className="admin-catalog-filter__suggest-code">{o.value}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function AdminCatalogFilter(props: {
  suppliers: Supplier[];
  shopCodes: string[];
  onShopCodesChange: (codes: string[]) => void;
  categories?: ItemCategory[];
  categoryCodes?: string[];
  onCategoryCodesChange?: (codes: string[]) => void;
  count: number;
  search?: string;
  onSearchChange?: (query: string) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  showUnlinkedOption?: boolean;
  showCount?: boolean;
}) {
  const { locale, t } = useLocale();
  const shopFieldId = useId();
  const categoryFieldId = useId();

  const sortedSuppliers = useMemo(
    () => sortSuppliersForPicker(props.suppliers.filter((s) => s.active !== false)),
    [props.suppliers]
  );

  const shopOptions = useMemo(
    () =>
      sortedSuppliers.map((s) => ({
        value: s.code,
        label: supplierDisplayName(s, locale),
      })),
    [sortedSuppliers, locale]
  );

  const shopByCode = useMemo(() => new Map(sortedSuppliers.map((s) => [s.code, s])), [sortedSuppliers]);

  const resolveShopQuery = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return null;
      const qLower = q.toLowerCase();
      if (props.showUnlinkedOption !== false) {
        const unlinkedFull = t("admin.catalog.filterUnlinked").toLowerCase();
        const unlinkedShort = t("admin.catalog.filterUnlinkedShort").toLowerCase();
        if (
          qLower === unlinkedFull ||
          qLower === unlinkedShort ||
          unlinkedFull.includes(qLower) ||
          unlinkedShort.includes(qLower)
        ) {
          return ITEM_FILTER_UNLINKED;
        }
      }
      const upper = q.toUpperCase();
      const exactCode = sortedSuppliers.find((s) => s.code.toUpperCase() === upper);
      if (exactCode) return exactCode.code;
      const exactName = sortedSuppliers.find(
        (s) => supplierDisplayName(s, locale).toLowerCase() === qLower
      );
      if (exactName) return exactName.code;
      const partial = sortedSuppliers.find((s) => {
        const name = supplierDisplayName(s, locale).toLowerCase();
        return name.includes(qLower) || s.code.toLowerCase().includes(qLower);
      });
      return partial?.code ?? null;
    },
    [sortedSuppliers, locale, props.showUnlinkedOption, t]
  );

  const shopChipLabel = useCallback(
    (value: string) => {
      if (value === ITEM_FILTER_UNLINKED) return t("admin.catalog.filterUnlinked");
      const s = shopByCode.get(value);
      return s ? supplierDisplayName(s, locale) : value;
    },
    [shopByCode, locale, t]
  );

  const sortedCategories = useMemo(
    () =>
      [...(props.categories ?? [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code)
      ),
    [props.categories]
  );

  const categoryOptions = useMemo(
    () =>
      sortedCategories.map((c) => ({
        value: c.code,
        label: itemCategoryDisplayName(c, locale),
      })),
    [sortedCategories, locale]
  );

  const categoryByCode = useMemo(
    () => new Map<string, ItemCategory>(sortedCategories.map((c) => [c.code, c])),
    [sortedCategories]
  );

  const resolveCategoryQuery = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return null;
      const upper = q.toUpperCase();
      const exactCode = sortedCategories.find((c) => c.code.toUpperCase() === upper);
      if (exactCode) return exactCode.code;
      const qLower = q.toLowerCase();
      const exactName = sortedCategories.find(
        (c) => itemCategoryDisplayName(c, locale).toLowerCase() === qLower
      );
      if (exactName) return exactName.code;
      const partial = sortedCategories.find((c) => {
        const name = itemCategoryDisplayName(c, locale).toLowerCase();
        return name.includes(qLower) || c.code.toLowerCase().includes(qLower);
      });
      return partial?.code ?? null;
    },
    [sortedCategories, locale]
  );

  const categoryChipLabel = useCallback(
    (value: string) => {
      const c = categoryByCode.get(value);
      return c ? itemCategoryDisplayName(c, locale) : value;
    },
    [categoryByCode, locale]
  );

  const showSearch = props.onSearchChange !== undefined;
  const showCategories =
    props.categories !== undefined &&
    props.categoryCodes !== undefined &&
    props.onCategoryCodesChange !== undefined;

  const unlinkedExtra = useMemo(
    () =>
      props.showUnlinkedOption !== false
        ? [
            {
              value: ITEM_FILTER_UNLINKED,
              label: t("admin.catalog.filterUnlinkedShort"),
              suggestLabel: t("admin.catalog.filterUnlinked"),
            },
          ]
        : undefined,
    [props.showUnlinkedOption, t]
  );

  return (
    <div className="admin-catalog-filter">
      <div className="admin-catalog-filter__row">
        {showSearch ? (
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
        ) : null}
        <AdminFilterChipPicker
          id={shopFieldId}
          label={t("admin.catalog.filterLabel")}
          placeholder={t("admin.catalog.filterShopsPlaceholder")}
          values={props.shopCodes}
          onChange={props.onShopCodesChange}
          options={shopOptions}
          extraSuggestions={unlinkedExtra}
          resolveQuery={resolveShopQuery}
          chipLabel={shopChipLabel}
        />
        {showCategories ? (
          <AdminFilterChipPicker
            id={categoryFieldId}
            label={t("admin.catalog.filterCategoryLabel")}
            placeholder={t("admin.catalog.filterCategoryPlaceholder")}
            values={props.categoryCodes!}
            onChange={props.onCategoryCodesChange!}
            options={categoryOptions}
            resolveQuery={resolveCategoryQuery}
            chipLabel={categoryChipLabel}
          />
        ) : null}
        {props.showCount !== false ? (
          <p className="admin-hint admin-catalog-filter__count">
            {t("admin.catalog.filterCount").replace("{n}", String(props.count))}
          </p>
        ) : null}
      </div>
    </div>
  );
}
