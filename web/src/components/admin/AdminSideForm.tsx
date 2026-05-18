"use client";

import { useLocale } from "@/context/LocaleContext";

export function AdminSideForm(props: {
  isEdit: boolean;
  addTitle: string;
  editTitle: string;
  dot?: "orange" | "purple" | "blue" | "green";
  className?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const { t } = useLocale();
  const dot = props.dot ?? (props.isEdit ? "purple" : "orange");

  return (
    <div
      className={[
        "admin-side-form card",
        `admin-side-form--${dot}`,
        props.isEdit ? "admin-side-form--editing" : "",
        props.className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {props.hideHeader ? null : (
        <div className="admin-side-form__header">
          <div className="admin-side-form__title-wrap">
            <span className={`admin-side-form__dot admin-side-form__dot--${dot}`} aria-hidden />
            <h2 className="admin-side-form__title">{props.isEdit ? props.editTitle : props.addTitle}</h2>
          </div>
          <span
            className={`admin-form-mode-badge ${props.isEdit ? "admin-form-mode-badge--edit" : "admin-form-mode-badge--add"}`}
          >
            {props.isEdit ? t("admin.form.modeEdit") : t("admin.form.modeAdd")}
          </span>
        </div>
      )}

      <div className="admin-side-form__body">{props.children}</div>

      {props.extra ? <div className="admin-side-form__extra">{props.extra}</div> : null}

      <div className="admin-side-form__footer">{props.footer}</div>
    </div>
  );
}

export function AdminFormSection(props: { title?: string; children: React.ReactNode }) {
  return (
    <section className="admin-form-section">
      {props.title ? <h3 className="admin-form-section__title">{props.title}</h3> : null}
      <div className="admin-form-section__fields">{props.children}</div>
    </section>
  );
}

export function AdminFormField(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-form-field${props.className ? ` ${props.className}` : ""}`}>
      <label className="lbl">{props.label}</label>
      {props.children}
      {props.hint ? <p className="admin-hint admin-form-field__hint">{props.hint}</p> : null}
    </div>
  );
}

export function AdminFormActions(props: {
  primaryLabel: string;
  onPrimary: () => void;
  saving?: boolean;
  disabled?: boolean;
  showCancel?: boolean;
  cancelDisabled?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  showDelete?: boolean;
  deleteLabel?: string;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const { t } = useLocale();
  const isMulti = Boolean(props.showCancel || props.showDelete);

  return (
    <div
      className={[
        "admin-form-actions",
        isMulti ? "admin-form-actions--multi" : "",
        props.showDelete ? "admin-form-actions--with-delete" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="btn btn-primary admin-form-actions__primary"
        disabled={props.saving || props.deleting || props.disabled}
        onClick={props.onPrimary}
      >
        {props.saving ? t("profile.saving") : props.primaryLabel}
      </button>
      {props.showCancel ? (
        <button
          type="button"
          className="btn btn-secondary admin-form-actions__secondary"
          disabled={props.saving || props.deleting || props.cancelDisabled}
          onClick={props.onCancel}
        >
          {props.cancelLabel ?? t("admin.shops.cancel")}
        </button>
      ) : null}
      {props.showDelete ? (
        <button
          type="button"
          className="btn btn-danger-outline admin-form-actions__delete"
          disabled={props.saving || props.deleting}
          onClick={props.onDelete}
        >
          {props.deleting ? t("profile.saving") : props.deleteLabel ?? t("admin.delete")}
        </button>
      ) : null}
    </div>
  );
}
