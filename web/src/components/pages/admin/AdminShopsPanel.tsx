"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { apiSucceeded } from "@/lib/api/success";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { sortSuppliersByCode, sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import {
  AdminFormActions,
  AdminFormField,
  AdminFormSection,
  AdminSideForm,
} from "@/components/admin/AdminSideForm";
import { useAdminFormUnsaved } from "@/components/admin/AdminUnsavedChangesProvider";
import { IconChevronDown, IconChevronUp } from "@/components/icons/AppIcons";
import { AdminCardTitle } from "@/components/pages/admin/admin-shared";
import type { Supplier } from "@/lib/types";

function subNames(s: Supplier) {
  const parts = [s.nameEN, s.nameKR].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function AdminShopsPanel() {
  const { suppliers, reload, role } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();
  const isAdmin = role === "admin";

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formNameTH, setFormNameTH] = useState("");
  const [formNameEN, setFormNameEN] = useState("");
  const [formNameKR, setFormNameKR] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formBaseline, setFormBaseline] = useState("");

  const isEdit = editingCode !== null;

  const formSnapshot = useMemo(
    () =>
      JSON.stringify({
        editingCode,
        formCode,
        formNameTH,
        formNameEN,
        formNameKR,
        formActive,
      }),
    [editingCode, formCode, formNameTH, formNameEN, formNameKR, formActive]
  );
  const dirty = formSnapshot !== formBaseline;

  useLayoutEffect(() => {
    setFormBaseline(formSnapshot);
  }, [editingCode]);

  const sortedShops = useMemo(() => sortSuppliersByCode(suppliers), [suppliers]);

  const intakeOrderShops = useMemo(
    () => sortSuppliersForPicker(suppliers.filter((s) => s.active !== false)),
    [suppliers]
  );

  const intakeOrderByCode = useMemo(() => {
    const map = new Map<string, number>();
    intakeOrderShops.forEach((s, i) => map.set(s.code, i + 1));
    return map;
  }, [intakeOrderShops]);

  const editingIntakeIndex = useMemo(() => {
    if (!editingCode) return -1;
    return intakeOrderShops.findIndex((s) => s.code === editingCode);
  }, [editingCode, intakeOrderShops]);

  const canReorderIntake =
    isAdmin &&
    isEdit &&
    formActive &&
    intakeOrderShops.length > 1 &&
    editingIntakeIndex >= 0;

  function resetForm() {
    setEditingCode(null);
    setFormCode("");
    setFormNameTH("");
    setFormNameEN("");
    setFormNameKR("");
    setFormActive(true);
    setDupWarning(null);
  }

  function startEdit(s: Supplier) {
    setEditingCode(s.code);
    setFormCode(s.code);
    setFormNameTH(s.nameTH);
    setFormNameEN(s.nameEN);
    setFormNameKR(s.nameKR);
    setFormActive(s.active !== false);
    setDupWarning(null);
  }

  async function checkDuplicate() {
    if (!formNameTH.trim()) {
      setDupWarning(null);
      return;
    }
    try {
      const q = new URLSearchParams({
        nameTH: formNameTH,
        nameEN: formNameEN,
        nameKR: formNameKR,
      });
      if (editingCode) q.set("excludeCode", editingCode);
      const r = await apiGet<{
        success: boolean;
        duplicate: boolean;
        existingName: string | null;
      }>(`/api/suppliers/check?${q}`);
      if (r.duplicate && r.existingName) {
        setDupWarning(t("admin.shops.duplicateWarning").replace("{name}", r.existingName));
      } else {
        setDupWarning(null);
      }
    } catch {
      setDupWarning(null);
    }
  }

  async function submitForm(): Promise<boolean> {
    if (!formNameTH.trim()) {
      toast(t("admin.fillRequired"));
      return false;
    }
    setSaving(true);
    try {
      if (isEdit && editingCode) {
        const r = await apiPatch<{ message: string }>(
          `/api/suppliers/${encodeURIComponent(editingCode)}`,
          {
            suppCode: isAdmin ? formCode.trim() : undefined,
            suppNameTH: formNameTH,
            suppNameEN: formNameEN,
            suppNameKR: formNameKR,
            active: isAdmin ? formActive : undefined,
          }
        );
        toast(r.message);
        if (apiSucceeded(r)) {
          await reload();
          return true;
        }
        return false;
      } else {
        const r = await apiPost<{ message: string }>("/api/suppliers", {
          suppCode: isAdmin ? formCode.trim() : "",
          suppNameTH: formNameTH,
          suppNameEN: formNameEN,
          suppNameKR: formNameKR,
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
    const ok = await submitForm();
    if (ok) resetForm();
  }

  const { guardAction } = useAdminFormUnsaved({
    dirty,
    save: submitForm,
    discard: useCallback(() => resetForm(), []),
  });

  function tryStartEdit(s: Supplier) {
    if (editingCode === s.code) return;
    guardAction(() => startEdit(s), dirty);
  }

  async function saveIntakeOrder(ordered: typeof intakeOrderShops) {
    setReordering(true);
    try {
      const r = await apiPost<{ message: string }>("/api/suppliers/reorder", {
        codes: ordered.map((s) => s.code),
      });
      toast(r.message);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setReordering(false);
    }
  }

  async function deleteShop() {
    if (!editingCode) return;
    const name = formNameTH.trim() || editingCode;
    const msg = t("admin.shops.deleteConfirm")
      .replace("{name}", name)
      .replace("{code}", editingCode);
    if (!window.confirm(msg)) return;

    setDeleting(true);
    try {
      const r = await apiDelete<{ message: string }>(
        `/api/suppliers/${encodeURIComponent(editingCode)}`
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

  function moveIntakeShop(code: string, direction: -1 | 1) {
    const idx = intakeOrderShops.findIndex((s) => s.code === code);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= intakeOrderShops.length) return;
    const copy = [...intakeOrderShops];
    const [item] = copy.splice(idx, 1);
    copy.splice(next, 0, item);
    void saveIntakeOrder(copy);
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-split">
        <div className="card admin-settings-split__list">
          <AdminCardTitle title={t("admin.shops.listTitle")} dot="blue" />
          {sortedShops.length ? (
            <div className="admin-shop-table-wrap">
              <table className="admin-shop-table admin-shop-table--cards">
                <thead>
                  <tr>
                    <th className="admin-shop-table__order-h">{t("admin.shops.orderCol")}</th>
                    {isAdmin ? <th>{t("admin.shops.code")}</th> : null}
                    <th>{t("admin.shops.nameTh")}</th>
                    <th>{t("admin.shops.namesSub")}</th>
                    {isAdmin ? <th>{t("admin.shops.active")}</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sortedShops.map((s) => (
                    <tr
                      key={s.code}
                      className={[
                        s.active === false ? "admin-shop-table__row--off" : "",
                        editingCode === s.code ? "admin-shop-table__row--selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined}
                    >
                      <td className="admin-shop-table__order" data-label={t("admin.shops.orderCol")}>
                        {s.active !== false && intakeOrderByCode.has(s.code)
                          ? intakeOrderByCode.get(s.code)
                          : "—"}
                      </td>
                      {isAdmin ? (
                        <td className="admin-shop-table__code" data-label={t("admin.shops.code")}>
                          {s.code}
                        </td>
                      ) : null}
                      <td data-label={t("admin.shops.nameTh")}>{supplierDisplayName(s, locale)}</td>
                      <td className="admin-shop-table__sub" data-label={t("admin.shops.namesSub")}>
                        {subNames(s)}
                      </td>
                      {isAdmin ? (
                        <td data-label={t("admin.shops.active")}>
                          <span
                            className={
                              s.active === false
                                ? "admin-shop-table__badge admin-shop-table__badge--off"
                                : "admin-shop-table__badge"
                            }
                          >
                            {s.active === false
                              ? t("admin.shops.statusInactive")
                              : t("admin.shops.statusActive")}
                          </span>
                        </td>
                      ) : null}
                      <td className="admin-shop-table__actions" data-label="">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => tryStartEdit(s)}>
                          {t("admin.shops.edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">{t("admin.shops.listEmpty")}</p>
          )}
          <p className="admin-hint" style={{ marginTop: 12 }}>
            {t("admin.shops.count").replace("{n}", String(sortedShops.length))}
          </p>
        </div>

        <AdminSideForm
          isEdit={isEdit}
          addTitle={t("admin.shops.addTitle")}
          editTitle={t("admin.shops.editTitle")}
          dot={isEdit ? "purple" : "orange"}
          footer={
            <AdminFormActions
              primaryLabel={isEdit ? t("admin.shops.save") : t("admin.shops.submit")}
              onPrimary={handlePrimarySave}
              saving={saving}
              disabled={!!dupWarning}
              showCancel
              cancelDisabled={!dirty}
              cancelLabel={t("admin.shops.cancel")}
              onCancel={resetForm}
              showDelete={isAdmin && isEdit}
              deleteLabel={t("admin.shops.delete")}
              onDelete={deleteShop}
              deleting={deleting}
            />
          }
        >
          {isAdmin ? (
            <AdminFormSection title={t("admin.form.sectionSettings")}>
              {isEdit ? (
                <div className="admin-form-meta-grid">
                  <AdminFormField label={t("admin.shops.code")} hint={t("admin.shops.codeHint")}>
                    <input
                      type="text"
                      className="admin-form-input--code"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      autoCapitalize="characters"
                    />
                  </AdminFormField>
                  <div className="admin-form-status-card">
                    <span className="admin-form-status-card__label">{t("admin.shops.active")}</span>
                    <label className="admin-form-status-toggle">
                      <input
                        type="checkbox"
                        checked={formActive}
                        onChange={(e) => setFormActive(e.target.checked)}
                      />
                      <span className="admin-form-status-toggle__track" aria-hidden />
                      <span className="admin-form-status-toggle__text">
                        {formActive ? t("admin.shops.statusActive") : t("admin.shops.statusInactive")}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <AdminFormField label={t("admin.shops.code")} hint={t("admin.shops.codeHint")}>
                  <input
                    type="text"
                    className="admin-form-input--code"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="S0001"
                    autoCapitalize="characters"
                  />
                </AdminFormField>
              )}
            </AdminFormSection>
          ) : null}

          <AdminFormSection title={t("admin.form.sectionNames")}>
            <AdminFormField label={t("admin.shops.nameTh")}>
              <input
                type="text"
                value={formNameTH}
                onChange={(e) => setFormNameTH(e.target.value)}
                onBlur={checkDuplicate}
              />
            </AdminFormField>
            <div className="admin-form-lang-grid">
              <AdminFormField label={t("admin.shops.nameEn")}>
                <input
                  type="text"
                  value={formNameEN}
                  onChange={(e) => setFormNameEN(e.target.value)}
                  onBlur={checkDuplicate}
                />
              </AdminFormField>
              <AdminFormField label={t("admin.shops.nameKr")}>
                <input
                  type="text"
                  value={formNameKR}
                  onChange={(e) => setFormNameKR(e.target.value)}
                  onBlur={checkDuplicate}
                />
              </AdminFormField>
            </div>
            {dupWarning ? (
              <p className="admin-warn admin-form-section__warn" role="alert">
                {dupWarning}
              </p>
            ) : null}
          </AdminFormSection>

          {isAdmin && isEdit && intakeOrderShops.length > 1 ? (
            <AdminFormSection title={t("admin.shops.intakeOrderTitle")}>
              {canReorderIntake ? (
                <div className="admin-form-intake-order">
                  <div className="admin-form-intake-order__meta">
                    <span className="admin-form-intake-order__badge">
                      {t("admin.shops.intakeOrderPosition")
                        .replace("{n}", String(editingIntakeIndex + 1))
                        .replace("{total}", String(intakeOrderShops.length))}
                    </span>
                    <p className="admin-hint admin-form-intake-order__hint">
                      {t("admin.shops.intakeOrderHintShort")}
                    </p>
                  </div>
                  <div
                    className="admin-form-intake-order__actions"
                    role="group"
                    aria-label={t("admin.shops.intakeOrderTitle")}
                  >
                    <button
                      type="button"
                      className="btn btn-icon-action admin-form-intake-order__btn"
                      disabled={reordering || saving || editingIntakeIndex === 0}
                      onClick={() => editingCode && moveIntakeShop(editingCode, -1)}
                      aria-label={t("admin.shops.moveUp")}
                    >
                      <IconChevronUp size={20} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon-action admin-form-intake-order__btn"
                      disabled={
                        reordering || saving || editingIntakeIndex >= intakeOrderShops.length - 1
                      }
                      onClick={() => editingCode && moveIntakeShop(editingCode, 1)}
                      aria-label={t("admin.shops.moveDown")}
                    >
                      <IconChevronDown size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="admin-hint admin-form-intake-order__inactive">
                  {t("admin.shops.intakeOrderInactiveHint")}
                </p>
              )}
            </AdminFormSection>
          ) : null}
        </AdminSideForm>
      </div>
    </div>
  );
}
