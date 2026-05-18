"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useLocale } from "@/context/LocaleContext";
import { getHomePath } from "@/lib/auth/paths";
import type { MessageKey } from "@/lib/i18n/messages";
import type { AppRole } from "@/lib/types";
import { apiPost } from "@/lib/api/client";

const ROLES: AppRole[] = ["operator", "manager", "admin"];

const ROLE_LABEL: Record<AppRole, MessageKey> = {
  operator: "role.operator",
  admin: "role.admin",
  manager: "role.manager",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<AppRole>("operator");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiPost("/api/auth/login", { pin, role });
      const home = getHomePath(role);
      const from = searchParams.get("from") || home;
      const dest = from.startsWith("/login") || !from ? home : from;
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-lang-corner">
        <LocaleSwitcher variant="loginCorner" />
      </div>
      <form onSubmit={handleSubmit} className="login-box">
        <LoginTitle subtitle={t("brand.subtitle")} />
        <div className="login-box__fields">
          <div className="login-sub">{t("login.subtitle")}</div>
          <div className="role-select">
            {ROLES.map((id) => (
              <button
                key={id}
                type="button"
                className={`role-opt ${role === id ? "selected" : ""}`}
                onClick={() => setRole(id)}
              >
                {t(ROLE_LABEL[id])}
              </button>
            ))}
          </div>
          <label className="lbl">{t("login.pin")}</label>
          <input
            type="password"
            inputMode="numeric"
            className="pin-input"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder=""
          aria-label={t("login.pin")}
            autoComplete="off"
          />
          {error ? <div className="login-error">{error}</div> : null}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: 16 }}
            disabled={loading || pin.length < 4}
          >
            {loading ? t("login.loading") : t("login.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

function LoginTitle({ subtitle }: { subtitle: string }) {
  return (
    <div className="login-brand">
      <Image
        src="/amazing-nkh-logo.png"
        alt="Amazing Nongkhai"
        width={666}
        height={471}
        sizes="(max-width: 484px) 92vw, 468px"
        quality={95}
        className="login-brand__logo"
        priority
      />
      <div className="login-brand__sub">{subtitle}</div>
    </div>
  );
}

function LoginFallback() {
  const { t } = useLocale();
  return (
    <div className="login-page">
      <div className="login-box">{t("login.loadingPage")}</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
