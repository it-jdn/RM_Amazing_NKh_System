"use client";

import { useId, useRef } from "react";
import { IconCheck, IconX } from "@/components/icons/AppIcons";
import { useLocale } from "@/context/LocaleContext";
import { useModalLayer } from "@/hooks/useModalLayer";
import type { AppRole } from "@/lib/types";

const ROLES: AppRole[] = ["operator", "admin", "manager"];

export type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  role: AppRole;
  pin: string;
  active: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  form: UserFormState;
  saving?: boolean;
  onChange: (patch: Partial<UserFormState>) => void;
  onClose: () => void;
  onSave: () => void;
};

export function AdminUserFormModal({
  open,
  mode,
  form,
  saving,
  onChange,
  onClose,
  onSave,
}: Props) {
  const { t } = useLocale();
  const isEdit = mode === "edit";
  const uid = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const idFirst = `${uid}-first`;
  const idLast = `${uid}-last`;
  const idEmail = `${uid}-email`;
  const idRole = `${uid}-role`;
  const idPin = `${uid}-pin`;
  const idActive = `${uid}-active`;

  useModalLayer({
    open,
    onClose,
    busy: saving,
    initialFocusRef: firstInputRef,
  });

  if (!open) return null;

  function roleLabel(r: AppRole) {
    if (r === "operator") return t("role.operator");
    if (r === "manager") return t("role.manager");
    return t("role.admin");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!saving) onSave();
  }

  return (
    <div className="modal-overlay open modal-overlay--users" role="presentation">
      <div
        className="modal-box users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="users-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span id="users-modal-title" className="modal-title">
            {isEdit ? t("admin.users.editTitle") : t("admin.users.createTitle")}
          </span>
          <button
            type="button"
            className="modal-close btn-icon-only"
            onClick={onClose}
            disabled={saving}
            tabIndex={-1}
            aria-label={t("intake.cancel")}
          >
            <IconX size={20} />
          </button>
        </div>

        <form className="users-modal__form" onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="users-modal__fields">
              <div className="users-modal__row">
                <div className="users-modal__field">
                  <label className="lbl" htmlFor={idFirst}>
                    {t("admin.users.firstName")}
                  </label>
                  <input
                    ref={firstInputRef}
                    id={idFirst}
                    value={form.firstName}
                    onChange={(e) => onChange({ firstName: e.target.value })}
                    autoComplete="given-name"
                  />
                </div>
                <div className="users-modal__field">
                  <label className="lbl" htmlFor={idLast}>
                    {t("admin.users.lastName")}
                  </label>
                  <input
                    id={idLast}
                    value={form.lastName}
                    onChange={(e) => onChange({ lastName: e.target.value })}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="users-modal__row">
                <div className="users-modal__field">
                  <label className="lbl" htmlFor={idEmail}>
                    {t("admin.users.email")}
                  </label>
                  <input
                    id={idEmail}
                    type="email"
                    value={form.email}
                    onChange={(e) => onChange({ email: e.target.value })}
                    autoComplete="email"
                  />
                </div>
                <div className="users-modal__field">
                  <label className="lbl" htmlFor={idRole}>
                    {t("admin.users.role")}
                  </label>
                  <select
                    id={idRole}
                    value={form.role}
                    onChange={(e) => onChange({ role: e.target.value as AppRole })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="users-modal__row">
                <div className="users-modal__field">
                  <label className="lbl" htmlFor={idPin}>
                    {isEdit ? t("admin.users.pinReset") : t("admin.users.pin")}
                  </label>
                  <input
                    id={idPin}
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={form.pin}
                    onChange={(e) => onChange({ pin: e.target.value })}
                    placeholder={isEdit ? t("admin.users.pinOptional") : "••••"}
                  />
                </div>
                <div className="users-modal__field users-modal__field--status">
                  <span className="lbl" id={`${uid}-active-lbl`}>
                    {t("admin.users.active")}
                  </span>
                  <label className="users-status-control" htmlFor={idActive}>
                    <input
                      id={idActive}
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => onChange({ active: e.target.checked })}
                      aria-labelledby={`${uid}-active-lbl`}
                    />
                    <span className="users-status-control__text">
                      {form.active ? t("admin.users.activeYes") : t("admin.users.activeNo")}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer users-modal__footer">
            <button
              type="button"
              className="btn btn-ghost btn--icon-adaptive"
              onClick={onClose}
              disabled={saving}
              aria-label={t("intake.cancel")}
            >
              <IconX size={18} className="btn--icon-adaptive__icon" />
              <span className="btn--icon-adaptive__text">{t("intake.cancel")}</span>
            </button>
            <button
              type="submit"
              className="btn btn-primary btn--icon-adaptive"
              disabled={saving}
              aria-label={isEdit ? t("admin.users.save") : t("admin.users.create")}
            >
              <IconCheck size={18} className="btn--icon-adaptive__icon" />
              <span className="btn--icon-adaptive__text">
                {saving
                  ? t("profile.saving")
                  : isEdit
                    ? t("admin.users.save")
                    : t("admin.users.create")}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
