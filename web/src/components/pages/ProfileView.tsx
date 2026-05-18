"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import type { AppUserPublic } from "@/lib/users/db";
import type { AppRole } from "@/lib/types";

type MeResponse = { user: AppUserPublic };

export function ProfileView() {
  const { t } = useLocale();
  const toast = useToast();
  const [user, setUser] = useState<AppUserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<MeResponse>("/api/users/me")
      .then((data) => setUser(data.user))
      .catch((e) => toast(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [toast]);

  function roleLabel(r: AppRole) {
    if (r === "operator") return t("role.operator");
    if (r === "manager") return t("role.manager");
    return t("role.admin");
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await apiPatch<{ message: string }>("/api/users/me", {
        currentPin,
        newPin,
        confirmPin,
      });
      toast(r.message);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty">{t("profile.loading")}</div>;
  }

  if (!user) {
    return <div className="empty">{t("profile.notFound")}</div>;
  }

  return (
    <div className="wrap profile-page">
      <h1 className="page-title">{t("profile.title")}</h1>

      <div className="card">
        <div className="card-title">
          <span className="dot dot-blue" />
          <span>{t("profile.infoTitle")}</span>
        </div>
        <dl className="profile-dl">
          <div>
            <dt>{t("profile.name")}</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>{t("admin.users.email")}</dt>
            <dd>{user.email || "—"}</dd>
          </div>
          <div>
            <dt>{t("admin.users.role")}</dt>
            <dd>{roleLabel(user.role)}</dd>
          </div>
        </dl>
        <p className="hint">{t("profile.infoHint")}</p>
      </div>

      <form className="card" onSubmit={savePin}>
        <div className="card-title">
          <span className="dot dot-green" />
          <span>{t("profile.pinTitle")}</span>
        </div>
        <p className="hint">{t("profile.pinHint")}</p>
        <div className="form-row">
          <div>
            <label className="lbl">{t("profile.currentPin")}</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row c2">
          <div>
            <label className="lbl">{t("profile.newPin")}</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />
          </div>
          <div>
            <label className="lbl">{t("profile.confirmPin")}</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t("profile.saving") : t("profile.savePin")}
        </button>
      </form>
    </div>
  );
}
