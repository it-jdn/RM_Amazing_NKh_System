"use client";

import { useState } from "react";
import { IconTrash } from "@/components/icons/AppIcons";
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
  slipId?: string;
  role: AppRole;
  className?: string;
  iconOnly?: boolean;
  onDeleted: () => void;
};

export function DeleteIntakeBatchButton({
  date,
  suppCode,
  suppName,
  slipId,
  role,
  className = "btn btn-danger-outline btn-sm",
  iconOnly = false,
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

    const msg = slipId
      ? t("intake.deleteSlipConfirm", {
          shop: suppName,
          date: formatAppDateLong(date, locale),
        })
      : t("intake.deleteBatchConfirm", {
          shop: suppName,
          date: formatAppDateLong(date, locale),
        });

    if (!confirm(msg)) return;

    setDeleting(true);
    try {
      const url = slipId
        ? `/api/transactions/batch?slipId=${encodeURIComponent(slipId)}`
        : `/api/transactions/batch?date=${encodeURIComponent(date)}&suppCode=${encodeURIComponent(suppCode)}`;
      const r = await apiDelete<{ success: boolean; message: string }>(url);
      onDeleted();
      alert(r.message || t("intake.toastDeleteOk"));
    } catch (e) {
      alert(e instanceof Error ? e.message : t("intake.toastDeleteFail"));
    } finally {
      setDeleting(false);
    }
  }

  const label = slipId ? t("intake.deleteSlip") : t("intake.deleteBatch");

  return (
    <button
      type="button"
      className={className}
      disabled={deleting || !allowed}
      title={!allowed ? deniedMessage() : iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      onClick={handleDelete}
    >
      {iconOnly ? (
        deleting ? (
          <span aria-hidden>…</span>
        ) : (
          <IconTrash size={20} aria-hidden />
        )
      ) : deleting ? (
        t("intake.deleting")
      ) : (
        label
      )}
    </button>
  );
}
