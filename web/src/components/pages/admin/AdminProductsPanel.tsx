"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppData } from "@/context/AppDataContext";
import { AdminCatalogFilter } from "@/components/admin/AdminCatalogFilter";
import { apiPost } from "@/lib/api/client";
import { apiSucceeded } from "@/lib/api/success";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { filterItemsByShop } from "@/lib/domain/item-filter";
import {
  buildItemShopCodesMap,
  itemLinkedShopNames,
} from "@/lib/domain/item-linked-shops";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { AdminItemShopUnitsEditor } from "@/components/admin/AdminItemShopUnitsEditor";
import { AdminFormActions } from "@/components/admin/AdminSideForm";
import { useAdminFormUnsaved } from "@/components/admin/AdminUnsavedChangesProvider";
import { AdminCardTitle } from "@/components/pages/admin/admin-shared";
import {
  emptyShopCfg,
  loadShopCfgForItem,
  shopProductConfigsFromCfg,
  validateShopCfg,
  type ShopCfg,
} from "@/lib/admin/item-shop-units-config";

function subNames(nameEN: string, nameKR: string) {
  const parts = [nameEN, nameKR].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function compareItemCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function AdminProductsPanel() {
  const { suppliers, items, mapping, purchaseUnits, itemPurchaseStandards, units, reload, role } =
    useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();
  const searchParams = useSearchParams();

  const [editCode, setEditCode] = useState("");
  const [nameTH, setNameTH] = useState("");
  const [nameEN, setNameEN] = useState("");
  const [nameKR, setNameKR] = useState("");
  const [shopCfg, setShopCfg] = useState<Record<string, ShopCfg>>({});
  const [filterSupp, setFilterSupp] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [cfgBaseline, setCfgBaseline] = useState("");
  const [refreshAfterSaveCode, setRefreshAfterSaveCode] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const list = filterItemsByShop(items, mapping, filterSupp);
    return [...list].sort((a, b) => compareItemCodes(a.code, b.code));
  }, [items, mapping, filterSupp]);

  const shopCodesByItem = useMemo(() => buildItemShopCodesMap(mapping), [mapping]);

  const linkedShopNames = useCallback(
    (itemCode: string) => itemLinkedShopNames(itemCode, shopCodesByItem, suppliers, locale),
    [shopCodesByItem, suppliers, locale]
  );

  const displayedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredItems;
    return filteredItems.filter((i) => {
      const shops = linkedShopNames(i.code).join(" ").toLowerCase();
      return (
        i.code.toLowerCase().includes(q) ||
        i.nameTH.toLowerCase().includes(q) ||
        i.nameEN.toLowerCase().includes(q) ||
        i.nameKR.toLowerCase().includes(q) ||
        shops.includes(q)
      );
    });
  }, [filteredItems, searchQuery, linkedShopNames]);

  const dirty = !!editCode && JSON.stringify(shopCfg) !== cfgBaseline;

  const unitsReady = units.length > 0;

  const deepLinkItem =
    searchParams.get("item")?.trim() || searchParams.get("edit")?.trim() || null;
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  useEffect(() => {
    if (!deepLinkItem || deepLinkHandled || !items.length) return;
    if (items.some((i) => i.code === deepLinkItem)) {
      loadProduct(deepLinkItem);
      setDeepLinkHandled(true);
    }
  }, [deepLinkItem, deepLinkHandled, items, suppliers, mapping]);

  useEffect(() => {
    if (!refreshAfterSaveCode) return;
    const it = items.find((i) => i.code === refreshAfterSaveCode);
    if (!it) return;
    setEditCode(it.code);
    setNameTH(it.nameTH);
    setNameEN(it.nameEN);
    setNameKR(it.nameKR);
    const next = loadShopCfgForItem(
      it.code,
      suppliers,
      mapping,
      purchaseUnits,
      itemPurchaseStandards
    );
    setShopCfg(next);
    setCfgBaseline(JSON.stringify(next));
    setRefreshAfterSaveCode(null);
  }, [
    refreshAfterSaveCode,
    items,
    suppliers,
    mapping,
    purchaseUnits,
    itemPurchaseStandards,
  ]);

  function loadProduct(code: string) {
    setEditCode(code);
    if (!code) {
      setNameTH("");
      setNameEN("");
      setNameKR("");
      const next: Record<string, ShopCfg> = {};
      for (const s of suppliers) next[s.code] = emptyShopCfg();
      setShopCfg(next);
      setCfgBaseline(JSON.stringify(next));
      return;
    }
    const it = items.find((i) => i.code === code);
    if (!it) return;
    setNameTH(it.nameTH);
    setNameEN(it.nameEN);
    setNameKR(it.nameKR);
    const next = loadShopCfgForItem(code, suppliers, mapping, purchaseUnits, itemPurchaseStandards);
    setShopCfg(next);
    setCfgBaseline(JSON.stringify(next));
  }

  async function save(): Promise<boolean> {
    if (!editCode) {
      toast(t("admin.products.pickProductRequired"));
      return false;
    }
    const item = items.find((i) => i.code === editCode);
    if (!item) {
      toast(t("admin.products.pickProductRequired"));
      return false;
    }
    if (!unitsReady) {
      toast(t("admin.products.unitsRequired"));
      return false;
    }

    const shops = shopProductConfigsFromCfg(
      editCode,
      shopCfg,
      suppliers,
      itemPurchaseStandards,
      units,
      locale
    );
    const cfgErr = validateShopCfg(shopCfg);
    if (cfgErr) {
      toast(cfgErr);
      return false;
    }

    if (shops.some((s) => !s.purchaseUnits.length)) {
      toast(t("admin.products.needIntakeUnit"));
      return false;
    }

    if (!shops.length) {
      toast(t("admin.products.needShop"));
      return false;
    }

    setSaving(true);
    try {
      const r = await apiPost<{ message: string; itemCode?: string }>("/api/products/setup", {
        itemCode: editCode,
        itemNameTH: item.nameTH,
        itemNameEN: item.nameEN,
        itemNameKR: item.nameKR,
        shops,
      });
      toast(r.message);
      if (apiSucceeded(r)) {
        const savedCode = editCode;
        await reload();
        setRefreshAfterSaveCode(savedCode);
        return true;
      }
      return false;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const { guardAction, requestNavigation } = useAdminFormUnsaved({
    dirty,
    save,
    discard: useCallback(() => {
      if (!editCode) return;
      const it = items.find((i) => i.code === editCode);
      if (!it) return;
      const next = loadShopCfgForItem(
        editCode,
        suppliers,
        mapping,
        purchaseUnits,
        itemPurchaseStandards
      );
      setShopCfg(next);
      setCfgBaseline(JSON.stringify(next));
    }, [editCode, suppliers, items, mapping, purchaseUnits, itemPurchaseStandards]),
  });

  function tryLoadProduct(code: string) {
    if (code === editCode) return;
    guardAction(() => loadProduct(code), dirty);
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-split">
        <div className="card admin-settings-split__list">
          <AdminCardTitle title={t("admin.products.listTitle")} dot="green" />
          {!unitsReady && (
            <p className="admin-warn" style={{ marginTop: 8 }}>
              {t("admin.products.unitsMissing")}{" "}
              {role === "admin" ? (
                <Link href="/admin/units">{t("admin.products.unitsLink")}</Link>
              ) : (
                t("admin.products.unitsAskAdmin")
              )}
            </p>
          )}
          <AdminCatalogFilter
            suppliers={suppliers}
            value={filterSupp}
            onChange={(code) => {
              setFilterSupp(code);
              if (editCode && !filterItemsByShop(items, mapping, code).some((i) => i.code === editCode)) {
                guardAction(() => loadProduct(""), dirty);
              }
            }}
            count={displayedItems.length}
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchLabel={t("admin.items.searchLabel")}
            searchPlaceholder={t("admin.items.searchPlaceholder")}
          />
          {displayedItems.length ? (
            <div className="admin-shop-table-wrap">
              <table className="admin-shop-table admin-shop-table--cards">
                <thead>
                  <tr>
                    <th className="admin-shop-table__order-h">{t("admin.table.rowCol")}</th>
                    <th>{t("admin.items.code")}</th>
                    <th>{t("admin.items.nameTh")}</th>
                    <th className="admin-items-table__sub">{t("admin.items.namesSub")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((i, rowIndex) => (
                    <tr
                      key={i.code}
                      className={editCode === i.code ? "admin-shop-table__row--selected" : undefined}
                    >
                      <td className="admin-shop-table__order" data-label={t("admin.table.rowCol")}>
                        {rowIndex + 1}
                      </td>
                      <td className="admin-shop-table__code" data-label={t("admin.items.code")}>
                        {i.code}
                      </td>
                      <td data-label={t("admin.items.nameTh")}>{i.nameTH}</td>
                      <td
                        className="admin-shop-table__sub admin-items-table__sub"
                        data-label={t("admin.items.namesSub")}
                      >
                        {subNames(i.nameEN, i.nameKR)}
                      </td>
                      <td className="admin-shop-table__actions" data-label="">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => tryLoadProduct(i.code)}>
                          {t("admin.products.edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">
              {filteredItems.length ? t("admin.items.searchEmpty") : t("admin.products.listEmpty")}
            </p>
          )}
          <p className="admin-hint" style={{ marginTop: 12 }}>
            {t("admin.products.count").replace("{n}", String(displayedItems.length))}
            {" · "}
            {t("admin.products.createOnItemsPage")}{" "}
            <Link href="/admin/items">{t("nav.settings.items")}</Link>
          </p>
        </div>

        <div className="card admin-settings-split__panel">
          {!editCode ? (
            <p className="admin-settings-empty">{t("admin.products.panelEmpty")}</p>
          ) : (
            <>
              <div className="admin-settings-split__panel-scroll">
                <AdminCardTitle title={t("admin.products.title")} dot="purple" />
                <div className="admin-product-names-readonly">
                  <p className="admin-product-names-readonly__label">{t("admin.products.namesReadonly")}</p>
                  <p className="admin-product-names-readonly__th">{nameTH}</p>
                  {(nameEN || nameKR) && (
                    <p className="admin-product-names-readonly__sub">
                      {[nameEN, nameKR].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <Link
                    href={`/admin/items?edit=${encodeURIComponent(editCode)}`}
                    className="admin-product-names-readonly__link"
                    onClick={(e) => {
                      if (dirty) {
                        e.preventDefault();
                        requestNavigation(`/admin/items?edit=${encodeURIComponent(editCode)}`);
                      }
                    }}
                  >
                    {t("admin.products.editNamesLink")}
                  </Link>
                </div>

                <h3 className="admin-section-title">{t("admin.products.shopsSection")}</h3>

                <AdminItemShopUnitsEditor
                  itemCode={editCode}
                  itemStandards={itemPurchaseStandards}
                  shopCfg={shopCfg}
                  onChange={setShopCfg}
                  suppliers={suppliers}
                  units={units}
                />
              </div>
              <div className="admin-settings-split__panel-footer">
                <AdminFormActions
                  primaryLabel={t("admin.products.saveEdit")}
                  onPrimary={() => void save()}
                  saving={saving}
                  disabled={!unitsReady}
                  showCancel
                  cancelDisabled={!dirty}
                  cancelLabel={t("admin.shops.cancel")}
                  onCancel={() => loadProduct(editCode)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
