"use client";

import { useLocale } from "@/context/LocaleContext";
import { AdminFormField } from "@/components/admin/AdminSideForm";
import {
  emptyStandardRow,
  type StandardUnitRow,
} from "@/lib/admin/item-standard-units-config";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { UnitOption } from "@/lib/types";

type Props = {
  rows: StandardUnitRow[];
  onChange: (rows: StandardUnitRow[]) => void;
  units: UnitOption[];
};

export function AdminItemStandardUnitsEditor({ rows, onChange, units }: Props) {
  const { locale, t } = useLocale();

  function patchRow(localId: string, patch: Partial<StandardUnitRow>) {
    onChange(rows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, emptyStandardRow(false)]);
  }

  function removeRow(localId: string) {
    if (rows.length <= 1) return;
    onChange(rows.filter((r) => r.localId !== localId));
  }

  return (
    <div className="admin-item-standard-units">
      <p className="admin-item-standard-units__intro">{t("admin.items.standardUnitsIntro")}</p>
      <ul className="admin-standard-unit-list">
        {rows.map((row, rowIdx) => (
          <li key={row.localId} className="admin-standard-unit-card">
            {rows.length > 1 ? (
              <div className="admin-standard-unit-card__head">
                <span className="admin-standard-unit-card__title">
                  {t("admin.items.standardUnitRow")} {rowIdx + 1}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm admin-standard-unit-card__remove"
                  onClick={() => removeRow(row.localId)}
                >
                  {t("admin.products.removeUnit")}
                </button>
              </div>
            ) : null}
            <div className="admin-standard-unit-card__grid">
              <AdminFormField label={t("admin.link.mainUnit")}>
                <select
                  value={row.mainUnitCode}
                  onChange={(e) => patchRow(row.localId, { mainUnitCode: e.target.value })}
                >
                  <option value="">{t("admin.link.select")}</option>
                  {units.map((u) => {
                    const taken = rows.some(
                      (other) =>
                        other.localId !== row.localId && other.mainUnitCode === u.unitCode
                    );
                    if (taken) return null;
                    return (
                      <option key={u.unitCode} value={u.unitCode}>
                        {unitDisplayName(u, locale)}
                      </option>
                    );
                  })}
                </select>
              </AdminFormField>
              <AdminFormField label={t("admin.link.subUnit")}>
                <select
                  value={row.subUnitCode}
                  onChange={(e) => patchRow(row.localId, { subUnitCode: e.target.value })}
                >
                  <option value="">{t("admin.link.select")}</option>
                  {units.map((u) => (
                    <option key={u.unitCode} value={u.unitCode}>
                      {unitDisplayName(u, locale)}
                    </option>
                  ))}
                </select>
              </AdminFormField>
              <AdminFormField
                label={t("admin.link.convert")}
                className="admin-standard-unit-card__convert"
              >
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={row.convertRate}
                  onChange={(e) => patchRow(row.localId, { convertRate: e.target.value })}
                />
              </AdminFormField>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-secondary btn-sm admin-standard-unit-list__add"
        onClick={addRow}
      >
        {t("admin.items.addStandardUnit")}
      </button>
    </div>
  );
}
