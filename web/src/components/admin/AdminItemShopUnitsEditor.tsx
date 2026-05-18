"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import {
  buildShopStandardsList,
  emptyShopCfg,
  normalizeShopStandards,
  resolveStandard,
  type ShopCfg,
  type ShopStandardRow,
} from "@/lib/admin/item-shop-units-config";
import { formatPurchaseUnitOptionLabel } from "@/lib/domain/purchase-units";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { ItemPurchaseUnit, ItemStandardPurchaseUnit, Supplier, UnitOption } from "@/lib/types";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";

type Props = {
  itemCode: string;
  itemStandards: ItemStandardPurchaseUnit[];
  shopCfg: Record<string, ShopCfg>;
  onChange: (next: Record<string, ShopCfg>) => void;
  suppliers: Supplier[];
  units: UnitOption[];
};

function unitOptionLabel(
  std: ItemStandardPurchaseUnit,
  units: UnitOption[],
  locale: Parameters<typeof unitDisplayName>[1]
) {
  const mainU = units.find((u) => u.unitCode === std.mainUnitCode);
  const subU = units.find((u) => u.unitCode === std.subUnitCode);
  const opt: ItemPurchaseUnit = {
    suppCode: "",
    itemCode: std.itemCode,
    mainUnitCode: std.mainUnitCode,
    subUnitCode: std.subUnitCode,
    mainUnit: mainU ? unitDisplayName(mainU, locale) : std.mainUnit,
    subUnit: subU ? unitDisplayName(subU, locale) : std.subUnit,
    convertRate: std.convertRate,
    standardUnitPrice: 0,
    isDefault: false,
    sortOrder: 0,
    active: true,
  };
  return formatPurchaseUnitOptionLabel(opt);
}

export function AdminItemShopUnitsEditor({
  itemCode,
  itemStandards,
  shopCfg,
  onChange,
  suppliers,
  units,
}: Props) {
  const { locale, t } = useLocale();
  const [copyFromSupp, setCopyFromSupp] = useState("");

  const standardsForItem = useMemo(
    () =>
      itemStandards
        .filter((s) => s.itemCode === itemCode)
        .sort((a, b) => a.sortOrder - b.sortOrder || (a.isDefault ? -1 : 1)),
    [itemStandards, itemCode]
  );

  const sortedSuppliers = useMemo(
    () =>
      [...suppliers].sort((a, b) =>
        supplierDisplayName(a, locale).localeCompare(supplierDisplayName(b, locale), locale)
      ),
    [suppliers, locale]
  );

  const displaySuppliers = useMemo(() => {
    return [...sortedSuppliers].sort((a, b) => {
      const aOn = shopCfg[a.code]?.enabled ? 1 : 0;
      const bOn = shopCfg[b.code]?.enabled ? 1 : 0;
      if (bOn !== aOn) return bOn - aOn;
      return supplierDisplayName(a, locale).localeCompare(supplierDisplayName(b, locale), locale);
    });
  }, [sortedSuppliers, shopCfg, locale]);

  const enabledShops = suppliers.filter((s) => shopCfg[s.code]?.enabled);

  function patchShop(suppCode: string, standards: ShopStandardRow[]) {
    onChange({
      ...shopCfg,
      [suppCode]: { enabled: true, standards: normalizeShopStandards(standards) },
    });
  }

  function toggleShop(suppCode: string, on: boolean) {
    if (on) {
      const base = buildShopStandardsList(itemCode, standardsForItem);
      const merged = base.map((r) => ({
        ...r,
        intakeEnabled: false,
        price: "",
      }));
      onChange({
        ...shopCfg,
        [suppCode]: { enabled: true, standards: normalizeShopStandards(merged) },
      });
      if (copyFromSupp && shopCfg[copyFromSupp]?.enabled) {
        const src = shopCfg[copyFromSupp].standards;
        patchShop(
          suppCode,
          buildShopStandardsList(itemCode, standardsForItem, src).map((r) => ({ ...r }))
        );
      }
    } else {
      onChange({
        ...shopCfg,
        [suppCode]: { ...shopCfg[suppCode], enabled: false },
      });
    }
  }

  function patchStandard(
    suppCode: string,
    mainUnitCode: string,
    patch: Partial<ShopStandardRow>
  ) {
    const shop = shopCfg[suppCode];
    if (!shop?.enabled) return;
    let standards = shop.standards.map((r) =>
      r.mainUnitCode === mainUnitCode ? { ...r, ...patch } : r
    );
    if (patch.intakeEnabled === true) {
      const enabled = standards.filter((r) => r.intakeEnabled);
      if (enabled.length && !enabled.some((r) => r.isDefault)) {
        standards = standards.map((r) =>
          r.mainUnitCode === mainUnitCode ? { ...r, isDefault: true } : r
        );
      }
    }
    patchShop(suppCode, standards);
  }

  function setDefaultStandard(suppCode: string, mainUnitCode: string) {
    const shop = shopCfg[suppCode];
    if (!shop?.enabled) return;
    patchShop(
      suppCode,
      shop.standards.map((r) => ({
        ...r,
        isDefault: r.mainUnitCode === mainUnitCode,
      }))
    );
  }

  function applyCopyFrom() {
    if (!copyFromSupp) return;
    const src = shopCfg[copyFromSupp];
    if (!src?.enabled) return;
    const next = { ...shopCfg };
    for (const s of suppliers) {
      if (s.code === copyFromSupp) continue;
      if (!next[s.code]?.enabled) continue;
      next[s.code] = {
        enabled: true,
        standards: normalizeShopStandards(
          buildShopStandardsList(itemCode, standardsForItem, src.standards)
        ),
      };
    }
    onChange(next);
  }

  if (!standardsForItem.length) {
    return <p className="admin-warn">{t("admin.products.needItemStandardsFirst")}</p>;
  }

  return (
    <div className="admin-item-shop-units">
      <p className="admin-item-shop-units__intro">{t("admin.products.shopsUnitsIntro")}</p>

      {enabledShops.length > 0 ? (
        <div className="form-row c2 admin-copy-row">
          <div>
            <label className="lbl">{t("admin.products.copyFrom")}</label>
            <select value={copyFromSupp} onChange={(e) => setCopyFromSupp(e.target.value)}>
              <option value="">{t("admin.link.select")}</option>
              {enabledShops.map((s) => (
                <option key={s.code} value={s.code}>
                  {supplierDisplayName(s, locale)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={applyCopyFrom}>
              {t("admin.products.copyApply")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="admin-product-shops">
        {displaySuppliers.map((s) => {
          const c = shopCfg[s.code] || emptyShopCfg(standardsForItem);
          const label = supplierDisplayName(s, locale);
          const rows = [...(c.standards || [])].sort((a, b) => a.sortOrder - b.sortOrder);

          return (
            <div
              key={s.code}
              className={`admin-product-shop${c.enabled ? " admin-product-shop--on" : ""}`}
            >
              <label className="admin-product-shop__toggle">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => toggleShop(s.code, e.target.checked)}
                />
                <span className="admin-product-shop__name">{label}</span>
              </label>
              {c.enabled ? (
                <div className="admin-product-shop__fields">
                  <p className="admin-product-shop__hint">{t("admin.products.shopUnitsSimpleHint")}</p>
                  <ul className="admin-shop-unit-list">
                    {rows.map((row) => {
                      const std = resolveStandard(standardsForItem, itemCode, row.mainUnitCode);
                      if (!std) return null;
                      const unitLabel = unitOptionLabel(std, units, locale);
                      const canDefault = row.intakeEnabled;
                      return (
                        <li
                          key={row.mainUnitCode}
                          className={`admin-shop-unit-list__item${row.intakeEnabled ? " admin-shop-unit-list__item--on" : ""}`}
                        >
                          <label className="admin-shop-unit-list__enable">
                            <input
                              type="checkbox"
                              checked={row.intakeEnabled}
                              onChange={(e) =>
                                patchStandard(s.code, row.mainUnitCode, {
                                  intakeEnabled: e.target.checked,
                                  isDefault: e.target.checked ? row.isDefault : false,
                                })
                              }
                            />
                            <span className="admin-shop-unit-list__label">{unitLabel}</span>
                          </label>
                          <div className="admin-shop-unit-list__price">
                            <label className="lbl">{t("admin.link.unitPrice")}</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!row.intakeEnabled}
                              value={row.price}
                              onChange={(e) =>
                                patchStandard(s.code, row.mainUnitCode, { price: e.target.value })
                              }
                            />
                          </div>
                          <label
                            className={`admin-shop-unit-list__default${!canDefault ? " admin-shop-unit-list__default--off" : ""}`}
                          >
                            <input
                              type="radio"
                              name={`shop-intake-default-${s.code}`}
                              disabled={!canDefault}
                              checked={row.isDefault && row.intakeEnabled}
                              onChange={() => setDefaultStandard(s.code, row.mainUnitCode)}
                            />
                            <span>{t("admin.products.intakeDefaultShort")}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
