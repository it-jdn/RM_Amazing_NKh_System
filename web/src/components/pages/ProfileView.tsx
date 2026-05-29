"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import type { AppUserPublic } from "@/lib/users/db";
import type { AppRole } from "@/lib/types";

type MeResponse = { user: AppUserPublic };
type MePatchResponse = { message: string; user?: AppUserPublic };

export function ProfileView() {
  const { t } = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [user, setUser] = useState<AppUserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    apiGet<MeResponse>("/api/users/me")
      .then((data) => {
        setUser(data.user);
        setFirstName(data.user.firstName);
        setLastName(data.user.lastName);
        setEmail(data.user.email);
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [toast]);

  function roleLabel(r: AppRole) {
    if (r === "operator") return t("role.operator");
    if (r === "manager") return t("role.manager");
    return t("role.admin");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const r = await apiPatch<MePatchResponse>("/api/users/me", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      toast(r.message);
      if (r.user) {
        setUser(r.user);
        setFirstName(r.user.firstName);
        setLastName(r.user.lastName);
        setEmail(r.user.email);
      }
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setSavingPin(true);
    try {
      const r = await apiPatch<MePatchResponse>("/api/users/me", {
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
      setSavingPin(false);
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

      <form className="card" onSubmit={saveProfile}>
        <div className="card-title">
          <span className="dot dot-blue" />
          <span>{t("profile.infoTitle")}</span>
        </div>
        <div className="form-row c2">
          <div>
            <label className="lbl" htmlFor="profile-first-name">
              {t("admin.users.firstName")}
            </label>
            <input
              id="profile-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="lbl" htmlFor="profile-last-name">
              {t("admin.users.lastName")}
            </label>
            <input
              id="profile-last-name"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div>
            <label className="lbl" htmlFor="profile-email">
              {t("admin.users.email")}
            </label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <dl className="profile-dl profile-dl--readonly">
          <div>
            <dt>{t("admin.users.role")}</dt>
            <dd>{roleLabel(user.role)}</dd>
          </div>
        </dl>
        <p className="hint">{t("profile.infoHint")}</p>
        <button type="submit" className="btn btn-primary" disabled={savingProfile}>
          {savingProfile ? t("profile.saving") : t("profile.saveProfile")}
        </button>
      </form>

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
        <button type="submit" className="btn btn-primary" disabled={savingPin}>
          {savingPin ? t("profile.saving") : t("profile.savePin")}
        </button>
      </form>
    </div>
  );
}
