"use client";

import { useState } from "react";
import { apiDelete } from "@/lib/api/client";
import {
  canDeleteIntakeBatch,
  OPERATOR_DELETE_DAYS,
} from "@/lib/auth/intake-permissions";
import { useLocale } from "@/context/LocaleContext";
import { formatAppDateLong } from "@/lib/utils/format";
import type { AppRole } from "@/lib/types";

type Props = {
  date: string;
  suppCode: string;
  suppName: string;
  role: AppRole;
  className?: string;
  onDeleted: () => void;
};

export function DeleteIntakeBatchButton({
  date,
  suppCode,
  suppName,
  role,
  className = "btn btn-danger-outline btn-sm",
  onDeleted,
}: Props) {
  const { locale, t } = useLocale();
  const [deleting, setDeleting] = useState(false);
  const allowed = canDeleteIntakeBatch(role, date);

  function deniedMessage() {
    if (role === "operator") {
      return t("auth.deleteDeniedOperator", { days: OPERATOR_DELETE_DAYS });
    }
    return t("auth.deleteDenied");
  }

  async function handleDelete() {
    if (!allowed) {
      alert(deniedMessage());
      return;
    }

    const msg = t("intake.deleteBatchConfirm", {
      shop: suppName,
      date: formatAppDateLong(date, locale),
    });

    if (!confirm(msg)) return;

    setDeleting(true);
    try {
      const r = await apiDelete<{ success: boolean; message: string }>(
        `/api/transactions/batch?date=${encodeURIComponent(date)}&suppCode=${encodeURIComponent(suppCode)}`
      );
      onDeleted();
      alert(r.message || t("intake.toastDeleteOk"));
    } catch (e) {
      alert(e instanceof Error ? e.message : t("intake.toastDeleteFail"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={deleting || !allowed}
      title={!allowed ? deniedMessage() : undefined}
      onClick={handleDelete}
    >
      {deleting ? t("intake.deleting") : t("intake.deleteBatch")}
    </button>
  );
}
