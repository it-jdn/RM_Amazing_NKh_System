"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
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

function isInvalidPinMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("pin ไม่ถูกต้อง") || m.includes("incorrect pin") || m.includes("pin이");
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const pinRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<AppRole>("operator");
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState(false);
  const [loading, setLoading] = useState(false);

  function selectRole(id: AppRole) {
    setRole(id);
    setError("");
    setPinError(false);
    requestAnimationFrame(() => pinRef.current?.focus());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPinError(false);
    setLoading(true);
    try {
      await apiPost("/api/auth/login", { pin, role });
      const home = getHomePath(role);
      const from = searchParams.get("from") || home;
      const dest = from.startsWith("/login") || !from ? home : from;
      router.push(dest);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("login.error");
      if (isInvalidPinMessage(message)) {
        setPinError(true);
        setError(t("login.errorPin"));
      } else {
        setError(message || t("login.error"));
      }
      pinRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {loading ? (
        <div
          className="login-busy-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-labelledby="login-busy-title"
        >
          <div className="login-busy-card">
            <span className="login-busy-spinner" aria-hidden />
            <p id="login-busy-title" className="login-busy-title">
              {t("login.loading")}
            </p>
            <p className="login-busy-hint">{t("login.busyHint")}</p>
          </div>
        </div>
      ) : null}
      <div className="login-lang-corner">
        <LocaleSwitcher variant="loginCorner" />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`login-box${loading ? " login-box--busy" : ""}`}
        aria-busy={loading || undefined}
      >
        <LoginTitle subtitle={t("brand.subtitle")} />
        <div className="login-box__fields">
          <div className="login-sub">{t("login.subtitle")}</div>
          <div className="role-select" role="group" aria-label={t("login.subtitle")}>
            {ROLES.map((id) => (
              <button
                key={id}
                type="button"
                className={`role-opt ${role === id ? "selected" : ""}`}
                onClick={() => selectRole(id)}
                disabled={loading}
              >
                {t(ROLE_LABEL[id])}
              </button>
            ))}
          </div>
          <label className="lbl" htmlFor="login-pin">
            {t("login.pin")}
          </label>
          <input
            ref={pinRef}
            id="login-pin"
            type="password"
            inputMode="numeric"
            className={`pin-input${pinError ? " pin-input--error" : ""}`}
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setPinError(false);
              setError("");
            }}
            placeholder=""
            aria-label={t("login.pin")}
            aria-invalid={pinError || undefined}
            aria-describedby={error ? "login-error" : undefined}
            autoComplete="off"
            disabled={loading}
          />
          {error ? (
            <div
              id="login-error"
              className="login-alert"
              role="alert"
              aria-live="assertive"
            >
              <span className="login-alert__icon" aria-hidden>
                !
              </span>
              <div className="login-alert__body">
                <p className="login-alert__title">
                  {pinError ? t("login.errorPinTitle") : t("login.errorTitle")}
                </p>
                <p className="login-alert__text">{error}</p>
              </div>
            </div>
          ) : null}
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
      <div className="login-busy-overlay" aria-busy="true">
        <div className="login-busy-card">
          <span className="login-busy-spinner" aria-hidden />
          <p className="login-busy-title">{t("login.loadingPage")}</p>
        </div>
      </div>
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
