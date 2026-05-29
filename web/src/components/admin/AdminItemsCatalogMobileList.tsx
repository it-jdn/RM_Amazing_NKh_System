"use client";

import { IconEdit, IconStoreLink } from "@/components/icons/AppIcons";
import { ItemShopChips } from "@/components/admin/AdminItemsCatalogTableUi";
import { useLocale } from "@/context/LocaleContext";
import {
  itemCategoryLabel,
  itemSubNames,
  itemUnitSummary,
  type ItemsCatalogSortKey,
} from "@/lib/admin/items-catalog-list";
import { itemDisplayName, itemSecondaryName } from "@/lib/i18n/item-name";
import type { MessageKey } from "@/lib/i18n/messages";
import type { Item, ItemCategory, UnitOption } from "@/lib/types";

const SORT_COLUMNS: { key: ItemsCatalogSortKey; labelKey: MessageKey }[] = [
  { key: "code", labelKey: "admin.items.code" },
  { key: "nameTH", labelKey: "admin.items.nameTh" },
  { key: "category", labelKey: "admin.items.categoryCol" },
  { key: "shops", labelKey: "admin.items.shopsCol" },
  { key: "units", labelKey: "admin.items.unitsCol" },
];

type Props = {
  items: Item[];
  itemCategories: ItemCategory[];
  units: UnitOption[];
  linkedShopNames: (code: string) => string[];
  noShopsLabel: string;
  selectedCode: string | null;
  sortKey: ItemsCatalogSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: ItemsCatalogSortKey) => void;
  onEdit: (item: Item) => void;
  onLink?: (item: Item) => void;
  variant?: "items" | "products";
};

export function AdminItemsCatalogMobileList({
  items,
  itemCategories,
  units,
  linkedShopNames,
  noShopsLabel,
  selectedCode,
  sortKey,
  sortDir,
  onSort,
  onEdit,
  onLink,
  variant = "items",
}: Props) {
  const { locale, t } = useLocale();

  return (
    <div className="admin-items-mobile">
      <div className="admin-items-mobile-sort" role="group" aria-label={t("admin.items.listTitle")}>
        {SORT_COLUMNS.map(({ key, labelKey }) => {
          const active = sortKey === key;
          return (
            <button
              key={key}
              type="button"
              className={`sort-toggle hist-preset-btn admin-items-mobile-sort__btn${active ? " active" : ""}`}
              onClick={() => onSort(key)}
              aria-pressed={active}
            >
              {t(labelKey)}
              {active ? (sortDir === "asc" ? " ▲" : " ▼") : null}
            </button>
          );
        })}
      </div>

      <ul className="admin-items-mobile-list">
        {items.map((item, index) => {
          const selected = selectedCode === item.code;
          const shopNames = linkedShopNames(item.code);
          const secondary = itemSecondaryName(item, locale);
          const subNames = itemSubNames(item.nameEN, item.nameKR);
          const showSubNames = subNames !== "—";

          return (
            <li key={item.code} id={`admin-item-row-${item.code}`}>
              <article
                className={`admin-items-mobile-card${selected ? " admin-items-mobile-card--selected" : ""}`}
              >
                <header className="admin-items-mobile-card__head">
                  <div className="admin-items-mobile-card__head-main">
                    <span className="admin-items-mobile-card__index">{index + 1}</span>
                    <span className="admin-items-mobile-card__code">{item.code}</span>
                  </div>
                  <div className="admin-items-mobile-card__actions">
                    {variant === "products" ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onEdit(item)}
                      >
                        {t("admin.products.edit")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn-icon-action btn-icon-action--compact"
                          onClick={() => onEdit(item)}
                          title={t("admin.items.edit")}
                          aria-label={`${t("admin.items.edit")}: ${item.nameTH}`}
                        >
                          <IconEdit size={18} />
                        </button>
                        {onLink ? (
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-action--compact"
                            onClick={() => onLink(item)}
                            title={t("admin.items.linkShops")}
                            aria-label={`${t("admin.items.linkShops")}: ${item.nameTH}`}
                          >
                            <IconStoreLink size={18} />
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </header>

                <h3 className="admin-items-mobile-card__title">{itemDisplayName(item, locale)}</h3>
                {secondary ? <p className="admin-items-mobile-card__secondary">{secondary}</p> : null}

                <dl className="admin-items-mobile-card__meta">
                  <div className="admin-items-mobile-card__meta-row">
                    <dt>{t("admin.items.categoryCol")}</dt>
                    <dd>{itemCategoryLabel(item.categoryCode, itemCategories, locale)}</dd>
                  </div>
                  <div className="admin-items-mobile-card__meta-row">
                    <dt>{t("admin.items.unitsCol")}</dt>
                    <dd>{itemUnitSummary(item, units, locale)}</dd>
                  </div>
                </dl>

                <div className="admin-items-mobile-card__shops">
                  <span className="admin-items-mobile-card__shops-label">{t("admin.items.shopsCol")}</span>
                  <ItemShopChips names={shopNames} emptyLabel={noShopsLabel} max={4} />
                </div>

                {showSubNames ? (
                  <p className="admin-items-mobile-card__langs">
                    <span className="admin-items-mobile-card__langs-label">{t("admin.items.namesSub")}</span>
                    {subNames}
                  </p>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
