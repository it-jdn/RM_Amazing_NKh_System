"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppData } from "@/context/AppDataContext";
import { AdminCatalogFilter } from "@/components/admin/AdminCatalogFilter";
import {
  AdminFormActions,
  AdminFormField,
  AdminFormSection,
  AdminSideForm,
} from "@/components/admin/AdminSideForm";
import { useAdminFormUnsaved } from "@/components/admin/AdminUnsavedChangesProvider";
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client";
import { apiSucceeded } from "@/lib/api/success";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { filterItemsByShop } from "@/lib/domain/item-filter";
import {
  buildItemShopCodesMap,
  itemLinkedShopNames,
} from "@/lib/domain/item-linked-shops";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import { AdminItemStandardUnitsEditor } from "@/components/admin/AdminItemStandardUnitsEditor";
import { AdminCardTitle } from "@/components/pages/admin/admin-shared";
import { useCompactAdminLayout } from "@/hooks/useCompactAdminLayout";
import {
  initStandardRowsForEdit,
  standardPayloadFromRows,
  validateStandardRows,
  type StandardUnitRow,
} from "@/lib/admin/item-standard-units-config";
import type { Locale } from "@/lib/i18n/types";
import type { Item, ItemCategoryCode, UnitOption } from "@/lib/types";

function ItemShopChips(props: { names: string[]; emptyLabel: string; max?: number }) {
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

function subNames(i: Item) {
  const parts = [i.nameEN, i.nameKR].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function compareItemCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

type ItemsSortKey = "code" | "nameTH" | "category" | "shops" | "units";

function ItemsTableSortTh(props: {
  label: string;
  column: ItemsSortKey;
  sortKey: ItemsSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: ItemsSortKey) => void;
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

function categoryLabel(
  code: ItemCategoryCode,
  categories: { code: ItemCategoryCode; nameTH: string; nameEN: string; nameKR: string }[],
  locale: Locale
) {
  const cat = categories.find((c) => c.code === code);
  return cat ? itemCategoryDisplayName(cat, locale) : code;
}

function unitSummary(i: Item, units: UnitOption[], locale: Locale) {
  const main = i.mainUnitCode ? units.find((u) => u.unitCode === i.mainUnitCode) : null;
  const sub = i.subUnitCode ? units.find((u) => u.unitCode === i.subUnitCode) : null;
  const mainLabel = main ? unitDisplayName(main, locale) : i.unit;
  const subLabel = sub ? unitDisplayName(sub, locale) : i.subUnit;
  if (!mainLabel && !subLabel) return "—";
  const conv = i.convertRate && i.convertRate !== 1 ? ` (${i.convertRate})` : "";
  return `${mainLabel || "—"} → ${subLabel || "—"}${conv}`;
}

export function AdminItemsPanel() {
  const {
    items,
    mapping,
    itemPurchaseStandards,
    suppliers,
    units,
    itemCategories: categoriesFromApi,
    reload,
    role,
  } = useAppData();
  const itemCategories = categoriesFromApi.length ? categoriesFromApi : FALLBACK_ITEM_CATEGORIES;
  const { locale, t } = useLocale();
  const toast = useToast();
  const searchParams = useSearchParams();
  const isAdmin = role === "admin";

  const [filterSupp, setFilterSupp] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ItemsSortKey>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formNameTH, setFormNameTH] = useState("");
  const [formNameEN, setFormNameEN] = useState("");
  const [formNameKR, setFormNameKR] = useState("");
  const [formMainUnitCode, setFormMainUnitCode] = useState("");
  const [formSubUnitCode, setFormSubUnitCode] = useState("");
  const [formConvertRate, setFormConvertRate] = useState("1");
  const [formCategoryCode, setFormCategoryCode] = useState<ItemCategoryCode | "">("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formBaseline, setFormBaseline] = useState("");
  const [standardRows, setStandardRows] = useState<StandardUnitRow[]>([]);
  const [refreshAfterSaveCode, setRefreshAfterSaveCode] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const compactLayout = useCompactAdminLayout();

  const isEdit = editingCode !== null;
  const formSheetOpen = compactLayout && (isEdit || addSheetOpen);

  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        editingCode,
        formCode,
        formNameTH,
        formNameEN,
        formNameKR,
        formMainUnitCode,
        formSubUnitCode,
        formConvertRate,
        formCategoryCode,
        standardRows: isEdit ? standardRows : null,
      }),
    [
      editingCode,
      formCode,
      formNameTH,
      formNameEN,
      formNameKR,
      formMainUnitCode,
      formSubUnitCode,
      formConvertRate,
      formCategoryCode,
      standardRows,
      isEdit,
    ]
  );
  const dirty = formSnapshot !== formBaseline;

  useLayoutEffect(() => {
    setFormBaseline(formSnapshot);
  }, [editingCode]);
  const unitsReady = units.length > 0;

  const sortedUnits = useMemo(
    () =>
      [...units].sort((a, b) =>
        unitDisplayName(a, locale).localeCompare(unitDisplayName(b, locale), locale)
      ),
    [units, locale]
  );

  const shopCodesByItem = useMemo(() => buildItemShopCodesMap(mapping), [mapping]);

  const linkedShopNames = useCallback(
    (itemCode: string) => itemLinkedShopNames(itemCode, shopCodesByItem, suppliers, locale),
    [shopCodesByItem, suppliers, locale]
  );

  const filteredItems = useMemo(
    () => filterItemsByShop(items, mapping, filterSupp),
    [items, mapping, filterSupp]
  );

  const noShopsLabel = t("admin.items.noShops");

  function handleSort(column: ItemsSortKey) {
    if (sortKey === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(column);
      setSortDir("asc");
    }
  }

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = q
      ? filteredItems.filter((i) => {
          const cat = categoryLabel(i.categoryCode, itemCategories, locale).toLowerCase();
          const shops = linkedShopNames(i.code).join(" ").toLowerCase();
          return (
            i.code.toLowerCase().includes(q) ||
            i.nameTH.toLowerCase().includes(q) ||
            i.nameEN.toLowerCase().includes(q) ||
            i.nameKR.toLowerCase().includes(q) ||
            cat.includes(q) ||
            shops.includes(q) ||
            noShopsLabel.toLowerCase().includes(q)
          );
        })
      : filteredItems;

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "code":
          cmp = compareItemCodes(a.code, b.code);
          break;
        case "nameTH":
          cmp = a.nameTH.localeCompare(b.nameTH, locale, { sensitivity: "base" });
          break;
        case "category":
          cmp = categoryLabel(a.categoryCode, itemCategories, locale).localeCompare(
            categoryLabel(b.categoryCode, itemCategories, locale),
            locale,
            { sensitivity: "base" }
          );
          break;
        case "shops": {
          const av = linkedShopNames(a.code).join(" · ") || noShopsLabel;
          const bv = linkedShopNames(b.code).join(" · ") || noShopsLabel;
          cmp = av.localeCompare(bv, locale, { sensitivity: "base" });
          break;
        }
        case "units":
          cmp = unitSummary(a, units, locale).localeCompare(unitSummary(b, units, locale), locale, {
            sensitivity: "base",
          });
          break;
      }
      return cmp * dir;
    });
    return list;
  }, [
    filteredItems,
    searchQuery,
    sortKey,
    sortDir,
    itemCategories,
    locale,
    linkedShopNames,
    units,
    noShopsLabel,
  ]);

  function resetForm() {
    setEditingCode(null);
    setFormCode("");
    setFormNameTH("");
    setFormNameEN("");
    setFormNameKR("");
    setFormMainUnitCode("");
    setFormSubUnitCode("");
    setFormConvertRate("1");
    setFormCategoryCode("");
    setStandardRows([]);
    setAddSheetOpen(false);
  }

  function closeFormSheet() {
    if (dirty && !window.confirm(t("admin.items.discardConfirm"))) return;
    resetForm();
  }

  function startAdd() {
    setEditingCode(null);
    setFormCode("");
    setFormNameTH("");
    setFormNameEN("");
    setFormNameKR("");
    setFormMainUnitCode("");
    setFormSubUnitCode("");
    setFormConvertRate("1");
    setFormCategoryCode("");
    setStandardRows([]);
    setAddSheetOpen(true);
  }

  function startEdit(i: Item) {
    setEditingCode(i.code);
    setFormCode(i.code);
    setFormNameTH(i.nameTH);
    setFormNameEN(i.nameEN);
    setFormNameKR(i.nameKR);
    setFormMainUnitCode(i.mainUnitCode || "");
    setFormSubUnitCode(i.subUnitCode || "");
    setFormConvertRate(String(i.convertRate ?? 1));
    setFormCategoryCode(i.categoryCode);
    setStandardRows(initStandardRowsForEdit(i, itemPurchaseStandards));
  }

  const deepLinkCode = searchParams.get("edit")?.trim() || null;
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (!deepLinkCode || deepLinkHandled) return;
    const item = items.find((i) => i.code === deepLinkCode);
    if (item) {
      startEdit(item);
      setAddSheetOpen(true);
      setDeepLinkHandled(true);
    }
  }, [deepLinkCode, items, deepLinkHandled]);

  useEffect(() => setSheetMounted(true), []);

  useEffect(() => {
    if (!formSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [formSheetOpen]);

  useEffect(() => {
    if (editingCode && !filteredItems.some((i) => i.code === editingCode)) {
      resetForm();
    }
  }, [filteredItems, editingCode]);

  useEffect(() => {
    if (!refreshAfterSaveCode) return;
    const i = items.find((x) => x.code === refreshAfterSaveCode);
    if (!i) return;
    const rows = initStandardRowsForEdit(i, itemPurchaseStandards);
    setEditingCode(i.code);
    setFormCode(i.code);
    setFormNameTH(i.nameTH);
    setFormNameEN(i.nameEN);
    setFormNameKR(i.nameKR);
    setFormMainUnitCode(i.mainUnitCode || "");
    setFormSubUnitCode(i.subUnitCode || "");
    setFormConvertRate(String(i.convertRate ?? 1));
    setFormCategoryCode(i.categoryCode);
    setStandardRows(rows);
    setFormBaseline(
      JSON.stringify({
        editingCode: i.code,
        formCode: i.code,
        formNameTH: i.nameTH,
        formNameEN: i.nameEN,
        formNameKR: i.nameKR,
        formMainUnitCode: i.mainUnitCode || "",
        formSubUnitCode: i.subUnitCode || "",
        formConvertRate: String(i.convertRate ?? 1),
        formCategoryCode: i.categoryCode,
        standardRows: rows,
      })
    );
    setRefreshAfterSaveCode(null);
  }, [refreshAfterSaveCode, items, itemPurchaseStandards]);

  async function submitForm(): Promise<boolean> {
    if (!formNameTH.trim()) {
      toast(t("admin.fillRequired"));
      return false;
    }
    if (!formCategoryCode) {
      toast(t("admin.items.categoryRequired"));
      return false;
    }
    const categoryCode = formCategoryCode as ItemCategoryCode;
    if (isEdit) {
      const stdErr = validateStandardRows(standardRows);
      if (stdErr) {
        toast(stdErr);
        return false;
      }
    } else if (!formMainUnitCode || !formSubUnitCode) {
      toast(t("admin.items.unitsRequired"));
      return false;
    }

    setSaving(true);
    try {
      const firstStd = standardRows[0];
      const payload = {
        itemCode: formCode.trim().toUpperCase() || undefined,
        itemNameTH: formNameTH,
        itemNameEN: formNameEN,
        itemNameKR: formNameKR,
        mainUnitCode:
          isEdit && firstStd?.mainUnitCode ? firstStd.mainUnitCode : formMainUnitCode,
        subUnitCode:
          isEdit && firstStd?.subUnitCode ? firstStd.subUnitCode : formSubUnitCode,
        convertRate:
          isEdit && firstStd ? parseFloat(firstStd.convertRate) || 1 : formConvertRate,
        categoryCode,
      };
      const r =
        isEdit && editingCode
          ? await apiPatch<{ message: string; itemCode?: string }>(
              `/api/items/${encodeURIComponent(editingCode)}`,
              payload
            )
          : await apiPost<{ message: string; itemCode?: string }>("/api/items/catalog", payload);
      if (!apiSucceeded(r)) {
        toast(r.message);
        return false;
      }

      const savedCode =
        isEdit && editingCode ? editingCode : (apiSucceeded(r) && r.itemCode ? r.itemCode : "");

      const standardsPayload =
        standardRows.length > 0
          ? standardPayloadFromRows(standardRows)
          : !isEdit && formMainUnitCode && formSubUnitCode
            ? [
                {
                  mainUnitCode: formMainUnitCode,
                  subUnitCode: formSubUnitCode,
                  convertRate: parseFloat(formConvertRate) || 1,
                  isDefault: true,
                  sortOrder: 0,
                },
              ]
            : [];

      if (savedCode && standardsPayload.length) {
        const stdRes = await apiPatch<{ success?: boolean; message: string }>(
          `/api/items/${encodeURIComponent(savedCode)}/purchase-standards`,
          { standards: standardsPayload }
        );
        if (!apiSucceeded(stdRes)) {
          toast(stdRes.message || "❌ บันทึกหน่วยมาตรฐานไม่สำเร็จ");
          return false;
        }
        toast(stdRes.message || r.message);
      } else {
        toast(r.message);
      }

      await reload();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "❌ เกิดข้อผิดพลาด");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePrimarySave() {
    const keepCode = editingCode;
    const ok = await submitForm();
    if (!ok) return;
    if (keepCode) {
      setRefreshAfterSaveCode(keepCode);
      return;
    }
    resetForm();
  }

  const { guardAction } = useAdminFormUnsaved({
    dirty,
    save: submitForm,
    discard: useCallback(() => resetForm(), []),
  });

  function tryStartEdit(i: Item) {
    if (editingCode === i.code) return;
    guardAction(() => {
      startEdit(i);
      setAddSheetOpen(true);
    }, dirty);
  }

  function tryStartAdd() {
    guardAction(() => startAdd(), dirty);
  }

  async function deleteItemRow() {
    if (!editingCode || !isAdmin) return;
    const name = formNameTH.trim() || editingCode;
    const msg = t("admin.items.deleteConfirm")
      .replace("{name}", name)
      .replace("{code}", editingCode);
    if (!window.confirm(msg)) return;

    setDeleting(true);
    try {
      const r = await apiDelete<{ message: string }>(
        `/api/items/${encodeURIComponent(editingCode)}`
      );
      toast(r.message);
      if (apiSucceeded(r)) {
        resetForm();
        await reload();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "❌ เกิดข้อผิดพลาด");
    } finally {
      setDeleting(false);
    }
  }

  const formTitle = isEdit ? t("admin.items.editTitle") : t("admin.items.addTitle");

  return (
    <div className="admin-settings-page admin-settings-page--items">
      <div className="admin-settings-split admin-settings-split--items">
        <div className="card admin-settings-split__list">
          <div className="admin-items-list-head">
            <AdminCardTitle title={t("admin.items.listTitle")} dot="blue" />
            {compactLayout && !formSheetOpen ? (
              <button
                type="button"
                className="btn btn-primary btn-sm admin-items-list-head__add"
                onClick={tryStartAdd}
                disabled={!unitsReady}
              >
                {t("admin.items.addTitle")}
              </button>
            ) : null}
          </div>
          {!unitsReady && (
            <p className="admin-warn" style={{ marginTop: 8 }}>
              {t("admin.items.unitsMissing")}{" "}
              {isAdmin ? (
                <Link href="/admin/units">{t("admin.items.unitsLink")}</Link>
              ) : (
                t("admin.items.unitsAskAdmin")
              )}
            </p>
          )}
          <AdminCatalogFilter
            suppliers={suppliers}
            value={filterSupp}
            onChange={setFilterSupp}
            count={displayedItems.length}
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchLabel={t("admin.items.searchLabel")}
            searchPlaceholder={t("admin.items.searchPlaceholder")}
          />
          {displayedItems.length ? (
            <div className="admin-shop-table-wrap">
              <table className="admin-shop-table admin-shop-table--cards admin-items-table">
                <thead>
                  <tr>
                    <th className="admin-shop-table__order-h">{t("admin.table.rowCol")}</th>
                    <ItemsTableSortTh
                      label={t("admin.items.code")}
                      column="code"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <ItemsTableSortTh
                      label={t("admin.items.nameTh")}
                      column="nameTH"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <ItemsTableSortTh
                      label={t("admin.items.categoryCol")}
                      column="category"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <ItemsTableSortTh
                      label={t("admin.items.shopsCol")}
                      column="shops"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="admin-items-table__shops"
                    />
                    <ItemsTableSortTh
                      label={t("admin.items.unitsCol")}
                      column="units"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="admin-items-table__units"
                    />
                    <th className="admin-items-table__sub">{t("admin.items.namesSub")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((i, rowIndex) => (
                    <tr
                      key={i.code}
                      className={editingCode === i.code ? "admin-shop-table__row--selected" : undefined}
                    >
                      <td className="admin-shop-table__order" data-label={t("admin.table.rowCol")}>
                        {rowIndex + 1}
                      </td>
                      <td className="admin-shop-table__code" data-label={t("admin.items.code")}>
                        {i.code}
                      </td>
                      <td data-label={t("admin.items.nameTh")}>{i.nameTH}</td>
                      <td
                        className="admin-shop-table__sub"
                        data-label={t("admin.items.categoryCol")}
                      >
                        {categoryLabel(i.categoryCode, itemCategories, locale)}
                      </td>
                      <td
                        className="admin-items-table__shops"
                        data-label={t("admin.items.shopsCol")}
                      >
                        <ItemShopChips
                          names={linkedShopNames(i.code)}
                          emptyLabel={t("admin.items.noShops")}
                        />
                      </td>
                      <td
                        className="admin-shop-table__sub admin-items-table__units"
                        data-label={t("admin.items.unitsCol")}
                      >
                        {unitSummary(i, units, locale)}
                      </td>
                      <td
                        className="admin-shop-table__sub admin-items-table__sub"
                        data-label={t("admin.items.namesSub")}
                      >
                        {subNames(i)}
                      </td>
                      <td className="admin-shop-table__actions" data-label="">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => tryStartEdit(i)}>
                          {t("admin.items.edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">
              {filteredItems.length ? t("admin.items.searchEmpty") : t("admin.items.listEmpty")}
            </p>
          )}
        </div>


        {!compactLayout && (
        <AdminSideForm
          className="admin-side-form--items"
          isEdit={isEdit}
          addTitle={t("admin.items.addTitle")}
          editTitle={t("admin.items.editTitle")}
          dot={isEdit ? "purple" : "orange"}
          footer={
            <AdminFormActions
              primaryLabel={isEdit ? t("admin.items.save") : t("admin.items.submit")}
              onPrimary={handlePrimarySave}
              saving={saving}
              disabled={!unitsReady}
              showCancel
              cancelLabel={isEdit ? t("admin.items.cancelEdit") : t("admin.items.cancel")}
              onCancel={() => {
                if (dirty && !confirm(t("admin.items.discardConfirm"))) return;
                resetForm();
              }}
              showDelete={isAdmin && isEdit}
              deleteLabel={t("admin.items.delete")}
              onDelete={deleteItemRow}
              deleting={deleting}
            />
          }
        >
          <AdminFormSection title={t("admin.form.sectionSettings")}>
            <div className="admin-items-form-meta">
              <AdminFormField
                label={t("admin.items.code")}
                hint={isEdit ? undefined : t("admin.items.codeHint")}
              >
                <input
                  type="text"
                  className="admin-form-input--code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder={isEdit ? undefined : "P0001"}
                  autoCapitalize="characters"
                  readOnly={isEdit}
                />
              </AdminFormField>
              <AdminFormField label={t("admin.items.category")}>
                <select
                  value={formCategoryCode}
                  onChange={(e) =>
                    setFormCategoryCode(e.target.value as ItemCategoryCode | "")
                  }
                >
                  <option value="">{t("admin.items.selectCategory")}</option>
                  {itemCategories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {itemCategoryDisplayName(c, locale)}
                    </option>
                  ))}
                </select>
              </AdminFormField>
            </div>
          </AdminFormSection>

          <AdminFormSection title={t("admin.form.sectionNames")}>
            <AdminFormField label={t("admin.items.nameTh")}>
              <input
                type="text"
                value={formNameTH}
                onChange={(e) => setFormNameTH(e.target.value)}
              />
            </AdminFormField>
            <div className="admin-form-lang-grid">
              <AdminFormField label={t("admin.items.nameEn")}>
                <input type="text" value={formNameEN} onChange={(e) => setFormNameEN(e.target.value)} />
              </AdminFormField>
              <AdminFormField label={t("admin.items.nameKr")}>
                <input type="text" value={formNameKR} onChange={(e) => setFormNameKR(e.target.value)} />
              </AdminFormField>
            </div>
          </AdminFormSection>

          {!isEdit ? (
            <AdminFormSection title={t("admin.items.sectionUnitsShort")}>
              <div className="admin-items-form-units">
                <AdminFormField label={t("admin.link.mainUnit")}>
                  <select
                    value={formMainUnitCode}
                    onChange={(e) => setFormMainUnitCode(e.target.value)}
                    disabled={!unitsReady}
                  >
                    <option value="">{t("admin.link.select")}</option>
                    {sortedUnits.map((u) => (
                      <option key={u.unitCode} value={u.unitCode}>
                        {unitDisplayName(u, locale)}
                      </option>
                    ))}
                  </select>
                </AdminFormField>
                <AdminFormField label={t("admin.link.subUnit")}>
                  <select
                    value={formSubUnitCode}
                    onChange={(e) => setFormSubUnitCode(e.target.value)}
                    disabled={!unitsReady}
                  >
                    <option value="">{t("admin.link.select")}</option>
                    {sortedUnits.map((u) => (
                      <option key={u.unitCode} value={u.unitCode}>
                        {unitDisplayName(u, locale)}
                      </option>
                    ))}
                  </select>
                </AdminFormField>
                <AdminFormField
                  label={t("admin.link.convert")}
                  className="admin-items-form-units__convert"
                >
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={formConvertRate}
                    onChange={(e) => setFormConvertRate(e.target.value)}
                    disabled={!unitsReady}
                  />
                </AdminFormField>
              </div>
            </AdminFormSection>
          ) : (
            <AdminFormSection title={t("admin.items.standardUnitsSection")}>
              <AdminItemStandardUnitsEditor
                rows={standardRows}
                onChange={setStandardRows}
                units={units}
              />
            </AdminFormSection>
          )}
        </AdminSideForm>
        )}
      </div>

      {formSheetOpen && sheetMounted
        ? createPortal(
            <div className="admin-item-form-sheet-portal" role="presentation">
              <button
                type="button"
                className="admin-form-sheet__backdrop"
                aria-label={t("intake.cancel")}
                onClick={closeFormSheet}
              />
              <div className="admin-item-form-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-item-form-sheet-title">
                <header className="admin-side-form-sheet-panel__hdr">
                  <h2 id="admin-item-form-sheet-title" className="admin-side-form-sheet-panel__title">
                    {formTitle}
                  </h2>
                  <button
                    type="button"
                    className="admin-side-form-sheet-panel__close"
                    onClick={closeFormSheet}
                    aria-label={t("intake.cancel")}
                  >
                    ×
                  </button>
                </header>
                <AdminSideForm
                  className="admin-side-form--items admin-side-form--in-sheet"
                  hideHeader
                  isEdit={isEdit}
                  addTitle={t("admin.items.addTitle")}
                  editTitle={t("admin.items.editTitle")}
                  dot={isEdit ? "purple" : "orange"}
                  footer={
                    <AdminFormActions
                      primaryLabel={isEdit ? t("admin.items.save") : t("admin.items.submit")}
                      onPrimary={handlePrimarySave}
                      saving={saving}
                      disabled={!unitsReady}
                      showCancel
                      cancelLabel={isEdit ? t("admin.items.cancelEdit") : t("admin.items.cancel")}
                      onCancel={() => {
                        if (dirty && !confirm(t("admin.items.discardConfirm"))) return;
                        resetForm();
                      }}
                      showDelete={isAdmin && isEdit}
                      deleteLabel={t("admin.items.delete")}
                      onDelete={deleteItemRow}
                      deleting={deleting}
                    />
                  }
                >
                  <AdminFormSection title={t("admin.form.sectionSettings")}>
                    <div className="admin-items-form-meta">
                      <AdminFormField
                        label={t("admin.items.code")}
                        hint={isEdit ? undefined : t("admin.items.codeHint")}
                      >
                        <input
                          type="text"
                          className="admin-form-input--code"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                          placeholder={isEdit ? undefined : "P0001"}
                          autoCapitalize="characters"
                          readOnly={isEdit}
                        />
                      </AdminFormField>
                      <AdminFormField label={t("admin.items.category")}>
                        <select
                          value={formCategoryCode}
                          onChange={(e) =>
                            setFormCategoryCode(e.target.value as ItemCategoryCode | "")
                          }
                        >
                          <option value="">{t("admin.items.selectCategory")}</option>
                          {itemCategories.map((c) => (
                            <option key={c.code} value={c.code}>
                              {itemCategoryDisplayName(c, locale)}
                            </option>
                          ))}
                        </select>
                      </AdminFormField>
                    </div>
                  </AdminFormSection>

                  <AdminFormSection title={t("admin.form.sectionNames")}>
                    <AdminFormField label={t("admin.items.nameTh")}>
                      <input
                        type="text"
                        value={formNameTH}
                        onChange={(e) => setFormNameTH(e.target.value)}
                      />
                    </AdminFormField>
                    <div className="admin-form-lang-grid">
                      <AdminFormField label={t("admin.items.nameEn")}>
                        <input
                          type="text"
                          value={formNameEN}
                          onChange={(e) => setFormNameEN(e.target.value)}
                        />
                      </AdminFormField>
                      <AdminFormField label={t("admin.items.nameKr")}>
                        <input
                          type="text"
                          value={formNameKR}
                          onChange={(e) => setFormNameKR(e.target.value)}
                        />
                      </AdminFormField>
                    </div>
                  </AdminFormSection>

                  {!isEdit ? (
                    <AdminFormSection title={t("admin.items.sectionUnitsShort")}>
                      <div className="admin-items-form-units">
                        <AdminFormField label={t("admin.link.mainUnit")}>
                          <select
                            value={formMainUnitCode}
                            onChange={(e) => setFormMainUnitCode(e.target.value)}
                            disabled={!unitsReady}
                          >
                            <option value="">{t("admin.link.select")}</option>
                            {sortedUnits.map((u) => (
                              <option key={u.unitCode} value={u.unitCode}>
                                {unitDisplayName(u, locale)}
                              </option>
                            ))}
                          </select>
                        </AdminFormField>
                        <AdminFormField label={t("admin.link.subUnit")}>
                          <select
                            value={formSubUnitCode}
                            onChange={(e) => setFormSubUnitCode(e.target.value)}
                            disabled={!unitsReady}
                          >
                            <option value="">{t("admin.link.select")}</option>
                            {sortedUnits.map((u) => (
                              <option key={u.unitCode} value={u.unitCode}>
                                {unitDisplayName(u, locale)}
                              </option>
                            ))}
                          </select>
                        </AdminFormField>
                        <AdminFormField
                          label={t("admin.link.convert")}
                          className="admin-items-form-units__convert"
                        >
                          <input
                            type="number"
                            min="0.0001"
                            step="any"
                            value={formConvertRate}
                            onChange={(e) => setFormConvertRate(e.target.value)}
                            disabled={!unitsReady}
                          />
                        </AdminFormField>
                      </div>
                    </AdminFormSection>
                  ) : (
                    <AdminFormSection title={t("admin.items.standardUnitsSection")}>
                      <AdminItemStandardUnitsEditor
                        rows={standardRows}
                        onChange={setStandardRows}
                        units={units}
                      />
                    </AdminFormSection>
                  )}
                </AdminSideForm>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
