"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client";
import { apiSucceeded } from "@/lib/api/success";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import {
  AdminFormActions,
  AdminFormField,
  AdminFormSection,
  AdminSideForm,
} from "@/components/admin/AdminSideForm";
import { useAdminFormUnsaved } from "@/components/admin/AdminUnsavedChangesProvider";
import { AdminCardTitle } from "@/components/pages/admin/admin-shared";
import type { UnitOption } from "@/lib/types";

function subNames(u: UnitOption) {
  const parts = [u.nameEN, u.nameKR].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function AdminUnitsPanel() {
  const { units, reload } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formUnitCode, setFormUnitCode] = useState("");
  const [formNameTH, setFormNameTH] = useState("");
  const [formNameEN, setFormNameEN] = useState("");
  const [formNameKR, setFormNameKR] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formBaseline, setFormBaseline] = useState("");

  const isEdit = editingCode !== null;

  const formSnapshot = useMemo(
    () => JSON.stringify({ editingCode, formUnitCode, formNameTH, formNameEN, formNameKR }),
    [editingCode, formUnitCode, formNameTH, formNameEN, formNameKR]
  );
  const dirty = formSnapshot !== formBaseline;

  useLayoutEffect(() => {
    setFormBaseline(formSnapshot);
  }, [editingCode]);

  const sortedUnits = useMemo(
    () =>
      [...units].sort((a, b) =>
        unitDisplayName(a, locale).localeCompare(unitDisplayName(b, locale), locale)
      ),
    [units, locale]
  );

  function resetForm() {
    setEditingCode(null);
    setFormUnitCode("");
    setFormNameTH("");
    setFormNameEN("");
    setFormNameKR("");
  }

  function startEdit(u: UnitOption) {
    setEditingCode(u.unitCode);
    setFormUnitCode(u.unitCode);
    setFormNameTH(u.nameTH);
    setFormNameEN(u.nameEN);
    setFormNameKR(u.nameKR);
  }

  async function submitForm(): Promise<boolean> {
    if (!formNameTH.trim()) {
      toast(t("admin.fillRequired"));
      return false;
    }
    setSaving(true);
    try {
      if (isEdit && editingCode) {
        const r = await apiPatch<{
          success?: boolean;
          message: string;
          unit?: UnitOption;
        }>(`/api/units/${encodeURIComponent(editingCode)}`, {
          nameTH: formNameTH,
          nameEN: formNameEN,
          nameKR: formNameKR,
          newUnitCode: formUnitCode.trim().toUpperCase(),
        });
        toast(r.message);
        if (apiSucceeded(r)) {
          await reload();
          if (r.unit) {
            startEdit(r.unit);
          }
          return true;
        }
        return false;
      } else {
        const r = await apiPost<{ success?: boolean; message: string }>("/api/units", {
          nameTH: formNameTH,
          nameEN: formNameEN,
          nameKR: formNameKR,
          unitCode: formUnitCode.trim() || undefined,
        });
        toast(r.message);
        if (apiSucceeded(r)) {
          await reload();
          return true;
        }
        return false;
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePrimarySave() {
    const wasEdit = isEdit;
    const ok = await submitForm();
    if (ok && !wasEdit) resetForm();
  }

  const { guardAction } = useAdminFormUnsaved({
    dirty,
    save: submitForm,
    discard: useCallback(() => resetForm(), []),
  });

  function tryStartEdit(u: UnitOption) {
    if (editingCode === u.unitCode) return;
    guardAction(() => startEdit(u), dirty);
  }

  async function deleteUnit() {
    if (!editingCode) return;
    const name = formNameTH.trim() || editingCode;
    const msg = t("admin.units.deleteConfirm")
      .replace("{name}", name)
      .replace("{code}", editingCode);
    if (!window.confirm(msg)) return;

    setDeleting(true);
    try {
      const r = await apiDelete<{ message: string }>(
        `/api/units/${encodeURIComponent(editingCode)}`
      );
      toast(r.message);
      if (apiSucceeded(r)) {
        resetForm();
        await reload();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-split">
        <div className="card admin-settings-split__list">
          <AdminCardTitle title={t("admin.units.listTitle")} dot="purple" />
          <p className="admin-hint">{t("admin.units.listHint")}</p>
            {sortedUnits.length ? (
              <div className="admin-shop-table-wrap">
                <table className="admin-shop-table admin-shop-table--cards">
                  <thead>
                    <tr>
                      <th className="admin-shop-table__order-h">{t("admin.table.rowCol")}</th>
                      <th>{t("admin.units.code")}</th>
                      <th>{t("admin.units.nameTh")}</th>
                      <th>{t("admin.units.namesSub")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUnits.map((u, rowIndex) => (
                      <tr
                        key={u.unitCode}
                        className={editingCode === u.unitCode ? "admin-shop-table__row--selected" : undefined}
                      >
                        <td className="admin-shop-table__order" data-label={t("admin.table.rowCol")}>
                          {rowIndex + 1}
                        </td>
                        <td className="admin-shop-table__code" data-label={t("admin.units.code")}>
                          {u.unitCode}
                        </td>
                        <td data-label={t("admin.units.nameTh")}>{unitDisplayName(u, locale)}</td>
                        <td className="admin-shop-table__sub" data-label={t("admin.units.namesSub")}>
                          {subNames(u)}
                        </td>
                        <td className="admin-shop-table__actions" data-label="">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => tryStartEdit(u)}>
                            {t("admin.units.edit")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">{t("admin.units.empty")}</p>
            )}
            <p className="admin-hint" style={{ marginTop: 12 }}>
              {t("admin.units.count").replace("{n}", String(sortedUnits.length))}
            </p>
        </div>

          <AdminSideForm
            isEdit={isEdit}
            addTitle={t("admin.units.addTitle")}
            editTitle={t("admin.units.editTitle")}
            dot={isEdit ? "blue" : "orange"}
            footer={
              <AdminFormActions
                primaryLabel={isEdit ? t("admin.units.save") : t("admin.units.addSubmit")}
                onPrimary={handlePrimarySave}
                saving={saving}
                showCancel
                cancelDisabled={!dirty}
                cancelLabel={t("admin.units.cancel")}
                onCancel={resetForm}
                showDelete={isEdit}
                deleteLabel={t("admin.units.delete")}
                onDelete={deleteUnit}
                deleting={deleting}
              />
            }
          >
            <AdminFormSection title={t("admin.form.sectionSettings")}>
              <AdminFormField label={t("admin.units.code")} hint={t("admin.units.codeHint")}>
                <input
                  type="text"
                  className="admin-form-input--code"
                  value={formUnitCode}
                  onChange={(e) => setFormUnitCode(e.target.value.toUpperCase())}
                  placeholder={isEdit ? undefined : t("admin.items.codeHint")}
                  autoCapitalize="characters"
                />
              </AdminFormField>
            </AdminFormSection>

            <AdminFormSection title={t("admin.form.sectionNames")}>
              <AdminFormField label={t("admin.units.nameTh")}>
                <input
                  type="text"
                  value={formNameTH}
                  onChange={(e) => setFormNameTH(e.target.value)}
                  placeholder={isEdit ? undefined : t("admin.units.addPlaceholder")}
                />
              </AdminFormField>
              <div className="admin-form-lang-grid">
                <AdminFormField label={t("admin.units.nameEn")}>
                  <input type="text" value={formNameEN} onChange={(e) => setFormNameEN(e.target.value)} />
                </AdminFormField>
                <AdminFormField label={t("admin.units.nameKr")}>
                  <input type="text" value={formNameKR} onChange={(e) => setFormNameKR(e.target.value)} />
                </AdminFormField>
              </div>
            </AdminFormSection>
          </AdminSideForm>
      </div>
    </div>
  );
}
