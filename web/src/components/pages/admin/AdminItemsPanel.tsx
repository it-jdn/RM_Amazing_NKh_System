"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { AdminItemsCatalogMobileList } from "@/components/admin/AdminItemsCatalogMobileList";
import { AdminItemsCatalogSortTh, ItemShopChips } from "@/components/admin/AdminItemsCatalogTableUi";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import {
  itemCategoryLabel,
  itemSubNames,
  itemUnitSummary,
  sortFilterItemsCatalog,
  type ItemsCatalogSortKey,
} from "@/lib/admin/items-catalog-list";
import { filterCatalogItems } from "@/lib/domain/item-filter";
import {
  buildItemShopCodesMap,
  itemLinkedShopNames,
} from "@/lib/domain/item-linked-shops";
import { hasAnyItemName, itemDisplayName } from "@/lib/i18n/item-name";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import { AdminItemStandardUnitsEditor } from "@/components/admin/AdminItemStandardUnitsEditor";
import {
  AdminItemShopLinkPanel,
  type AdminItemShopLinkPanelHandle,
} from "@/components/pages/admin/AdminItemShopLinkPanel";
import { IconEdit, IconStoreLink } from "@/components/icons/AppIcons";
import { AdminCardTitle } from "@/components/pages/admin/admin-shared";
import { useCompactAdminLayout } from "@/hooks/useCompactAdminLayout";
import {
  defaultStandardRow,
  initStandardRowsForEdit,
  standardPayloadFromRows,
  validateStandardRows,
  type StandardUnitRow,
} from "@/lib/admin/item-standard-units-config";
import type { Item, ItemCategoryCode } from "@/lib/types";

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

  const [filterShopCodes, setFilterShopCodes] = useState<string[]>([]);
  const [filterCategoryCodes, setFilterCategoryCodes] = useState<string[]>([]);
  const catalogFilters = useMemo(
    () => ({ shopCodes: filterShopCodes, categoryCodes: filterCategoryCodes }),
    [filterShopCodes, filterCategoryCodes]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ItemsCatalogSortKey>("code");
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
  /** หลังเพิ่มสินค้าใหม่ — เลื่อนและไฮไลต์แถวในรายการ */
  const [focusedItemCode, setFocusedItemCode] = useState<string | null>(null);
  const focusScrollPendingRef = useRef<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkDirty, setLinkDirty] = useState(false);
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const linkPanelRef = useRef<AdminItemShopLinkPanelHandle | null>(null);
  const compactLayout = useCompactAdminLayout();

  const isEdit = editingCode !== null;
  const formSheetOpen = compactLayout && (isEdit || addSheetOpen);
  const linkPanelOpen = compactLayout && !!linkCode && linkSheetOpen;
  const anyPanelOpen = formSheetOpen || linkPanelOpen;
  const showItemFormDesktop = !compactLayout && !linkCode;
  const showLinkPanelDesktop = !compactLayout && !!linkCode;

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

  const codeDupWarning = useMemo(() => {
    const nc = formCode.trim().toUpperCase();
    if (!nc) return null;
    if (isEdit && editingCode && nc === editingCode.toUpperCase()) return null;
    const taken = items.find((i) => i.code.toUpperCase() === nc);
    if (!taken) return null;
    return t("admin.items.codeDuplicate")
      .replace("{code}", nc)
      .replace("{name}", taken.nameTH);
  }, [formCode, isEdit, editingCode, items, t]);

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
    () => filterCatalogItems(items, mapping, catalogFilters),
    [items, mapping, catalogFilters]
  );

  const noShopsLabel = t("admin.items.noShops");

  function handleSort(column: ItemsCatalogSortKey) {
    if (sortKey === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(column);
      setSortDir("asc");
    }
  }

  const displayedItems = useMemo(
    () =>
      sortFilterItemsCatalog({
        items,
        mapping,
        catalogFilters,
        searchQuery,
        sortKey,
        sortDir,
        itemCategories,
        locale,
        units,
        linkedShopNames,
        noShopsLabel,
      }),
    [
      items,
      mapping,
      catalogFilters,
      searchQuery,
      sortKey,
      sortDir,
      itemCategories,
      locale,
      units,
      linkedShopNames,
      noShopsLabel,
    ]
  );

  function clearLinkPanel() {
    setLinkCode(null);
    setLinkDirty(false);
    setLinkSheetOpen(false);
  }

  function resetForm() {
    setFocusedItemCode(null);
    focusScrollPendingRef.current = null;
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
    clearLinkPanel();
  }

  function closeFormSheet() {
    if (dirty && !window.confirm(t("admin.items.discardConfirm"))) return;
    resetForm();
  }

  function startAdd() {
    clearLinkPanel();
    setFocusedItemCode(null);
    focusScrollPendingRef.current = null;
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
    if (compactLayout) setAddSheetOpen(true);
  }

  function startEdit(i: Item) {
    setFocusedItemCode(null);
    focusScrollPendingRef.current = null;
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

  const deepLinkEdit = searchParams.get("edit")?.trim() || null;
  const deepLinkLink =
    searchParams.get("link")?.trim() ||
    searchParams.get("item")?.trim() ||
    null;
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (deepLinkHandled || !items.length) return;
    if (deepLinkLink) {
      const item = items.find((i) => i.code === deepLinkLink);
      if (item) {
        clearLinkPanel();
        setLinkCode(item.code);
        setLinkSheetOpen(true);
        setDeepLinkHandled(true);
      }
      return;
    }
    if (deepLinkEdit) {
      const item = items.find((i) => i.code === deepLinkEdit);
      if (item) {
        clearLinkPanel();
        startEdit(item);
        if (compactLayout) setAddSheetOpen(true);
        setDeepLinkHandled(true);
      }
    }
  }, [deepLinkEdit, deepLinkLink, items, deepLinkHandled]);

  useEffect(() => setSheetMounted(true), []);

  useEffect(() => {
    if (!anyPanelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyPanelOpen]);

  useEffect(() => {
    if (editingCode && !filteredItems.some((i) => i.code === editingCode)) {
      resetForm();
    } else if (linkCode && !filteredItems.some((i) => i.code === linkCode)) {
      clearLinkPanel();
    }
  }, [filteredItems, editingCode, linkCode]);

  useLayoutEffect(() => {
    const code = focusedItemCode;
    if (!code) return;
    if (!items.some((i) => i.code === code)) return;

    if (!displayedItems.some((i) => i.code === code)) {
      if (focusScrollPendingRef.current !== code) {
        focusScrollPendingRef.current = code;
        setSearchQuery(code);
      }
      return;
    }
    focusScrollPendingRef.current = null;

    const scrollToRow = () => {
      document.getElementById(`admin-item-row-${code}`)?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToRow));
  }, [focusedItemCode, displayedItems, items]);

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

  async function submitForm(): Promise<string | false> {
    if (!hasAnyItemName({ nameTH: formNameTH, nameEN: formNameEN, nameKR: formNameKR })) {
      toast(t("admin.items.nameAnyRequired"));
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

    const newCode = formCode.trim().toUpperCase();
    if (isEdit && isAdmin && !newCode) {
      toast(t("admin.items.codeRequired"));
      return false;
    }
    if (codeDupWarning) {
      toast(codeDupWarning);
      return false;
    }

    setSaving(true);
    try {
      const defaultStd = defaultStandardRow(standardRows);
      const payload = {
        itemCode: isAdmin ? newCode || undefined : undefined,
        itemNameTH: formNameTH,
        itemNameEN: formNameEN,
        itemNameKR: formNameKR,
        mainUnitCode: isEdit
          ? defaultStd?.mainUnitCode || formMainUnitCode
          : formMainUnitCode,
        subUnitCode: isEdit
          ? defaultStd?.subUnitCode || formSubUnitCode
          : formSubUnitCode,
        convertRate: isEdit
          ? defaultStd
            ? parseFloat(defaultStd.convertRate) || 1
            : formConvertRate
          : formConvertRate,
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
        isEdit && editingCode
          ? apiSucceeded(r) && r.itemCode
            ? r.itemCode
            : editingCode
          : apiSucceeded(r) && r.itemCode
            ? r.itemCode
            : "";

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
      return savedCode || false;
    } catch (e) {
      toast(e instanceof Error ? e.message : "❌ เกิดข้อผิดพลาด");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePrimarySave() {
    const saved = await submitForm();
    if (!saved) return;
    if (editingCode) {
      setRefreshAfterSaveCode(formCode.trim().toUpperCase() || editingCode);
      return;
    }
    resetForm();
    setFocusedItemCode(saved);
  }

  const anyDirty = dirty || linkDirty;

  const { guardAction, requestNavigation } = useAdminFormUnsaved({
    dirty: anyDirty,
    save: useCallback(async () => {
      if (linkCode && linkDirty && linkPanelRef.current) {
        return linkPanelRef.current.save();
      }
      return Boolean(await submitForm());
    }, [linkCode, linkDirty, submitForm]),
    discard: useCallback(() => {
      if (linkCode && linkDirty && linkPanelRef.current) {
        linkPanelRef.current.discard();
        setLinkDirty(false);
        return;
      }
      resetForm();
    }, [linkCode, linkDirty]),
  });

  function tryStartEdit(i: Item) {
    if (editingCode === i.code && formSheetOpen) return;
    guardAction(() => {
      clearLinkPanel();
      startEdit(i);
      if (compactLayout) setAddSheetOpen(true);
    }, anyDirty);
  }

  function tryStartLink(i: Item) {
    if (linkCode === i.code && linkPanelOpen) return;
    guardAction(() => {
      setFocusedItemCode(null);
      focusScrollPendingRef.current = null;
      setEditingCode(null);
      setAddSheetOpen(false);
      setLinkCode(i.code);
      setLinkSheetOpen(true);
    }, anyDirty);
  }

  function tryStartAdd() {
    guardAction(() => startAdd(), anyDirty);
  }

  function closeLinkSheet() {
    if (linkDirty && !window.confirm(t("admin.items.discardConfirm"))) return;
    clearLinkPanel();
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
            <div className="admin-items-list-head__title-row">
              <div className="admin-items-list-head__title-group">
                <AdminCardTitle title={t("admin.items.listTitle")} dot="blue" />
                {!compactLayout || !anyPanelOpen ? (
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
              <p className="admin-items-list-count">
                {t("admin.items.count").replace("{n}", String(displayedItems.length))}
              </p>
            </div>
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
            shopCodes={filterShopCodes}
            onShopCodesChange={setFilterShopCodes}
            categories={itemCategories}
            categoryCodes={filterCategoryCodes}
            onCategoryCodesChange={setFilterCategoryCodes}
            count={displayedItems.length}
            showCount={false}
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchLabel={t("admin.items.searchLabel")}
            searchPlaceholder={t("admin.items.searchPlaceholder")}
          />
          {displayedItems.length ? compactLayout ? (
            <AdminItemsCatalogMobileList
              items={displayedItems}
              itemCategories={itemCategories}
              units={units}
              linkedShopNames={linkedShopNames}
              noShopsLabel={noShopsLabel}
              selectedCode={editingCode ?? linkCode ?? focusedItemCode}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onEdit={tryStartEdit}
              onLink={tryStartLink}
              variant="items"
            />
          ) : (
            <div className="admin-shop-table-wrap">
              <table className="admin-shop-table admin-items-table">
                <thead>
                  <tr>
                    <th className="admin-shop-table__order-h">{t("admin.table.rowColShort")}</th>
                    <AdminItemsCatalogSortTh
                      label={t("admin.items.code")}
                      column="code"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="admin-items-table__code-h"
                    />
                    <AdminItemsCatalogSortTh
                      label={t("admin.items.nameTh")}
                      column="nameTH"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <AdminItemsCatalogSortTh
                      label={t("admin.items.categoryCol")}
                      column="category"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <AdminItemsCatalogSortTh
                      label={t("admin.items.shopsCol")}
                      column="shops"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="admin-items-table__shops"
                    />
                    <AdminItemsCatalogSortTh
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
                      id={`admin-item-row-${i.code}`}
                      className={
                        editingCode === i.code ||
                        linkCode === i.code ||
                        focusedItemCode === i.code
                          ? "admin-shop-table__row--selected"
                          : undefined
                      }
                    >
                      <td className="admin-shop-table__order" data-label={t("admin.table.rowCol")}>
                        {rowIndex + 1}
                      </td>
                      <td className="admin-shop-table__code" data-label={t("admin.items.code")}>
                        {i.code}
                      </td>
                      <td data-label={t("admin.items.nameTh")}>{itemDisplayName(i, locale)}</td>
                      <td
                        className="admin-shop-table__sub"
                        data-label={t("admin.items.categoryCol")}
                      >
                        {itemCategoryLabel(i.categoryCode, itemCategories, locale)}
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
                        {itemUnitSummary(i, units, locale)}
                      </td>
                      <td
                        className="admin-shop-table__sub admin-items-table__sub"
                        data-label={t("admin.items.namesSub")}
                      >
                        {itemSubNames(i.nameEN, i.nameKR)}
                      </td>
                      <td className="admin-shop-table__actions" data-label="">
                        <div className="admin-shop-table__action-group">
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-action--compact"
                            onClick={() => tryStartEdit(i)}
                            title={t("admin.items.edit")}
                            aria-label={`${t("admin.items.edit")}: ${i.nameTH}`}
                          >
                            <IconEdit size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-action--compact"
                            onClick={() => tryStartLink(i)}
                            title={t("admin.items.linkShops")}
                            aria-label={`${t("admin.items.linkShops")}: ${i.nameTH}`}
                          >
                            <IconStoreLink size={16} />
                          </button>
                        </div>
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


        {!compactLayout && showLinkPanelDesktop && (
          <div className="card admin-settings-split__panel">
            <AdminItemShopLinkPanel
              ref={linkPanelRef}
              itemCode={linkCode}
              onDirtyChange={setLinkDirty}
              onClose={clearLinkPanel}
              onEditNamesNavigate={requestNavigation}
            />
          </div>
        )}

        {!compactLayout && showItemFormDesktop && (
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
              disabled={!unitsReady || Boolean(codeDupWarning)}
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
                hint={
                  isEdit && isAdmin
                    ? t("admin.items.codeEditHint")
                    : isEdit
                      ? undefined
                      : t("admin.items.codeHint")
                }
              >
                <input
                  type="text"
                  className="admin-form-input--code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder={isEdit ? undefined : "P0001"}
                  autoCapitalize="characters"
                  readOnly={isEdit && !isAdmin}
                  aria-invalid={codeDupWarning ? true : undefined}
                />
                {codeDupWarning ? (
                  <p className="admin-warn" role="alert">
                    {codeDupWarning}
                  </p>
                ) : null}
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
            <p className="admin-items-names-hint">{t("admin.items.namesHint")}</p>
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

      {linkPanelOpen && sheetMounted
        ? createPortal(
            <div className="admin-item-form-sheet-portal" role="presentation">
              <button
                type="button"
                className="admin-form-sheet__backdrop"
                aria-label={t("intake.cancel")}
                onClick={closeLinkSheet}
              />
              <div
                className="admin-item-form-sheet admin-item-form-sheet--link"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-item-link-sheet-title"
              >
                <header className="admin-side-form-sheet-panel__hdr">
                  <h2 id="admin-item-link-sheet-title" className="admin-side-form-sheet-panel__title">
                    {t("admin.products.title")}
                  </h2>
                  <button
                    type="button"
                    className="admin-side-form-sheet-panel__close"
                    onClick={closeLinkSheet}
                    aria-label={t("intake.cancel")}
                  >
                    ×
                  </button>
                </header>
                <div className="card admin-settings-split__panel admin-settings-split__panel--in-sheet">
                  <AdminItemShopLinkPanel
                    ref={linkPanelRef}
                    itemCode={linkCode!}
                    onDirtyChange={setLinkDirty}
                    onClose={closeLinkSheet}
                    onEditNamesNavigate={requestNavigation}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

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
                      disabled={!unitsReady || Boolean(codeDupWarning)}
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
                        hint={
                          isEdit && isAdmin
                            ? t("admin.items.codeEditHint")
                            : isEdit
                              ? undefined
                              : t("admin.items.codeHint")
                        }
                      >
                        <input
                          type="text"
                          className="admin-form-input--code"
                          value={formCode}
                          onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                          placeholder={isEdit ? undefined : "P0001"}
                          autoCapitalize="characters"
                          readOnly={isEdit && !isAdmin}
                          aria-invalid={codeDupWarning ? true : undefined}
                        />
                        {codeDupWarning ? (
                          <p className="admin-warn" role="alert">
                            {codeDupWarning}
                          </p>
                        ) : null}
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
                    <p className="admin-items-names-hint">{t("admin.items.namesHint")}</p>
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
