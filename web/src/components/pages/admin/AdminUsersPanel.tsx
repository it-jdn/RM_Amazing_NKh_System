"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { IconEdit, IconUserPlus } from "@/components/icons/AppIcons";
import {
  AdminUserFormModal,
  type UserFormState,
} from "@/components/pages/admin/AdminUserFormModal";
import type { AppUserPublic } from "@/lib/users/db";
import type { AppRole } from "@/lib/types";

type UsersResponse = { users: AppUserPublic[] };

const EMPTY_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "operator",
  pin: "",
  active: true,
};

export function AdminUsersPanel() {
  const { t } = useLocale();
  const toast = useToast();
  const [users, setUsers] = useState<AppUserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<UsersResponse>("/api/users");
      setUsers(data.users);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalMode("create");
  }

  function openEdit(u: AppUserPublic) {
    setEditingId(u.id);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      pin: "",
      active: u.active,
    });
    setModalMode("edit");
  }

  function patchForm(patch: Partial<UserFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    if (modalMode === "create") {
      if (!form.firstName.trim() || !form.email.trim() || !form.pin.trim()) {
        toast(t("admin.fillRequired"));
        return;
      }
      setSaving(true);
      try {
        const r = await apiPost<{ message: string }>("/api/users", {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          role: form.role,
          pin: form.pin,
          active: form.active,
        });
        toast(r.message);
        closeModal();
        await load();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Error");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!editingId || !form.firstName.trim() || !form.email.trim()) {
      toast(t("admin.fillRequired"));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        active: form.active,
      };
      if (form.pin.trim()) body.pin = form.pin;
      const r = await apiPatch<{ message: string }>(`/api/users/${editingId}`, body);
      toast(r.message);
      closeModal();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function roleLabel(r: AppRole) {
    if (r === "operator") return t("role.operator");
    if (r === "manager") return t("role.manager");
    return t("role.admin");
  }

  return (
    <>
      <div className="card users-panel">
        <div className="users-panel__toolbar">
          <div className="card-title users-panel__title">
            <span className="dot dot-orange" />
            <span>{t("admin.users.listTitle")}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn--icon-adaptive"
            onClick={openCreate}
            aria-label={t("admin.users.add")}
          >
            <IconUserPlus size={18} className="btn--icon-adaptive__icon" />
            <span className="btn--icon-adaptive__text">{t("admin.users.add")}</span>
          </button>
        </div>

        {loading ? (
          <div className="empty">{t("admin.users.loading")}</div>
        ) : !users.length ? (
          <div className="users-panel__empty">
            <p className="empty">{t("admin.users.empty")}</p>
            <button
              type="button"
              className="btn btn-primary btn--icon-adaptive"
              onClick={openCreate}
              aria-label={t("admin.users.add")}
            >
              <IconUserPlus size={18} className="btn--icon-adaptive__icon" />
              <span className="btn--icon-adaptive__text">{t("admin.users.add")}</span>
            </button>
          </div>
        ) : (
          <div className="tbl-scroll">
            <table className="dtbl users-table users-table--cards">
              <thead>
                <tr>
                  <th>{t("admin.users.name")}</th>
                  <th className="users-table__col-email">{t("admin.users.email")}</th>
                  <th>{t("admin.users.role")}</th>
                  <th className="users-table__col-status">{t("admin.users.status")}</th>
                  <th className="users-table__col-actions" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={!u.active ? "users-table__inactive" : undefined}>
                    <td data-label={t("admin.users.name")}>
                      <div className="mi-name">{u.displayName}</div>
                      {u.firstName || u.lastName ? (
                        <div className="mi-sub">
                          {u.firstName} {u.lastName}
                        </div>
                      ) : null}
                    </td>
                    <td className="users-table__col-email" data-label={t("admin.users.email")}>
                      {u.email || "—"}
                    </td>
                    <td data-label={t("admin.users.role")}>{roleLabel(u.role)}</td>
                    <td className="users-table__col-status" data-label={t("admin.users.status")}>
                      <span className={`rx-badge ${u.active ? "rx-yes" : "rx-no"}`}>
                        {u.active ? t("admin.users.activeYes") : t("admin.users.activeNo")}
                      </span>
                    </td>
                    <td className="users-table__col-actions" data-label="">
                      <button
                        type="button"
                        className="btn-icon-action"
                        onClick={() => openEdit(u)}
                        aria-label={`${t("admin.users.edit")}: ${u.displayName}`}
                      >
                        <IconEdit size={18} />
                        <span className="btn-icon-action__text">{t("admin.users.edit")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminUserFormModal
        open={modalMode !== null}
        mode={modalMode === "edit" ? "edit" : "create"}
        form={form}
        saving={saving}
        onChange={patchForm}
        onClose={closeModal}
        onSave={handleSave}
      />
    </>
  );
}
