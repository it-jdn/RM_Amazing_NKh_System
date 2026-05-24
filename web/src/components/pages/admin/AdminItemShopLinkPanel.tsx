"use client";

import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from "react";
import Link from "next/link";
import { useAppData } from "@/context/AppDataContext";
import { AdminItemShopUnitsEditor } from "@/components/admin/AdminItemShopUnitsEditor";
import { AdminFormActions } from "@/components/admin/AdminSideForm";
import { apiPost } from "@/lib/api/client";
import { apiSucceeded } from "@/lib/api/success";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { AdminCardTitle } from "@/components/pages/admin/admin-shared";
import {
  effectiveItemPurchaseStandards,
  emptyShopCfg,
  loadShopCfgForItem,
  shopProductConfigsFromCfg,
  validateShopCfg,
  type ShopCfg,
} from "@/lib/admin/item-shop-units-config";

export type AdminItemShopLinkPanelHandle = {
  save: () => Promise<boolean>;
  discard: () => void;
};

export const AdminItemShopLinkPanel = forwardRef<
  AdminItemShopLinkPanelHandle,
  {
    itemCode: string;
    onDirtyChange?: (dirty: boolean) => void;
    onClose?: () => void;
    onSaved?: (code: string) => void;
    onEditNamesNavigate?: (href: string) => void;
  }
>(function AdminItemShopLinkPanel(
  { itemCode, onDirtyChange, onClose, onSaved, onEditNamesNavigate },
  ref
) {
  const {
    suppliers,
    items,
    mapping,
    purchaseUnits,
    itemPurchaseStandards,
    units,
    reload,
    role,
  } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();

  const [nameTH, setNameTH] = useState("");
  const [nameEN, setNameEN] = useState("");
  const [nameKR, setNameKR] = useState("");
  const [shopCfg, setShopCfg] = useState<Record<string, ShopCfg>>({});
  const [saving, setSaving] = useState(false);
  const [cfgBaseline, setCfgBaseline] = useState("");

  const unitsReady = units.length > 0;
  const dirty = !!itemCode && JSON.stringify(shopCfg) !== cfgBaseline;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const standardsForItemCode = useCallback(
    (code: string) =>
      effectiveItemPurchaseStandards(
        items.find((i) => i.code === code),
        itemPurchaseStandards
      ),
    [items, itemPurchaseStandards]
  );

  const loadCfg = useCallback(
    (code: string) => {
      const it = items.find((i) => i.code === code);
      if (!it) return;
      setNameTH(it.nameTH);
      setNameEN(it.nameEN);
      setNameKR(it.nameKR);
      const next = loadShopCfgForItem(
        code,
        suppliers,
        mapping,
        purchaseUnits,
        standardsForItemCode(code)
      );
      setShopCfg(next);
      setCfgBaseline(JSON.stringify(next));
    },
    [items, suppliers, mapping, purchaseUnits, standardsForItemCode]
  );

  useEffect(() => {
    if (itemCode) loadCfg(itemCode);
  }, [itemCode, loadCfg]);

  async function save(): Promise<boolean> {
    const item = items.find((i) => i.code === itemCode);
    if (!item) {
      toast(t("admin.products.pickProductRequired"));
      return false;
    }
    if (!unitsReady) {
      toast(t("admin.products.unitsRequired"));
      return false;
    }

    const shops = shopProductConfigsFromCfg(
      itemCode,
      shopCfg,
      suppliers,
      standardsForItemCode(itemCode),
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
        itemCode,
        itemNameTH: item.nameTH,
        itemNameEN: item.nameEN,
        itemNameKR: item.nameKR,
        shops,
      });
      toast(r.message);
      if (apiSucceeded(r)) {
        await reload();
        loadCfg(itemCode);
        onSaved?.(itemCode);
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

  useImperativeHandle(
    ref,
    () => ({
      save,
      discard: () => loadCfg(itemCode),
    }),
    [itemCode, save, loadCfg]
  );

  if (!itemCode) {
    return (
      <p className="admin-settings-empty">{t("admin.products.panelEmpty")}</p>
    );
  }

  return (
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
            href={`/admin/items?edit=${encodeURIComponent(itemCode)}`}
            className="admin-product-names-readonly__link"
            onClick={(e) => {
              if (dirty && onEditNamesNavigate) {
                e.preventDefault();
                onEditNamesNavigate(`/admin/items?edit=${encodeURIComponent(itemCode)}`);
              }
            }}
          >
            {t("admin.products.editNamesLink")}
          </Link>
        </div>

        <h3 className="admin-section-title">{t("admin.products.shopsSection")}</h3>
        <p className="admin-hint admin-products-shops-hint">{t("admin.products.shopsSectionHint")}</p>

        {!unitsReady && (
          <p className="admin-warn">
            {t("admin.products.unitsMissing")}{" "}
            {role === "admin" ? (
              <Link href="/admin/units">{t("admin.products.unitsLink")}</Link>
            ) : (
              t("admin.products.unitsAskAdmin")
            )}
          </p>
        )}

        <AdminItemShopUnitsEditor
          itemCode={itemCode}
          itemStandards={standardsForItemCode(itemCode)}
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
          onCancel={() => {
            if (dirty && !window.confirm(t("admin.items.discardConfirm"))) return;
            loadCfg(itemCode);
            onClose?.();
          }}
        />
      </div>
    </>
  );
});
