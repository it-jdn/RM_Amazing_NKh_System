"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import { formatPurchaseUnitOptionLabel } from "@/lib/domain/purchase-units";
import type { ItemPurchaseUnit } from "@/lib/types";

type Props = {
  options: ItemPurchaseUnit[];
  valueMainUnitCode: string;
  onChange: (mainUnitCode: string) => void;
  className?: string;
  disabled?: boolean;
};

/** เลือกหน่วยซื้อเข้า — มากกว่า 1 ตัวเลือกใช้ dropdown */
export function IntakePurchaseUnitSelect({
  options,
  valueMainUnitCode,
  onChange,
  className,
  disabled = false,
}: Props) {
  const { t } = useLocale();

  const sorted = useMemo(
    () =>
      [...options].sort(
        (a, b) =>
          (a.isDefault ? 0 : 1) - (b.isDefault ? 0 : 1) ||
          a.sortOrder - b.sortOrder ||
          a.mainUnit.localeCompare(b.mainUnit)
      ),
    [options]
  );

  const selected =
    sorted.find((o) => o.mainUnitCode === valueMainUnitCode) ?? sorted[0];

  if (sorted.length <= 1) {
    const label = selected ? formatPurchaseUnitOptionLabel(selected) : "—";
    return (
      <span className={className ? `intake-purchase-unit-static ${className}` : "intake-purchase-unit-static"}>
        {label}
      </span>
    );
  }

  return (
    <select
      className={className ? `intake-purchase-unit-select ${className}` : "intake-purchase-unit-select"}
      value={valueMainUnitCode || selected?.mainUnitCode || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={t("intake.purchaseUnit")}
    >
      {sorted.map((o) => (
        <option key={o.mainUnitCode} value={o.mainUnitCode}>
          {formatPurchaseUnitOptionLabel(o)}
        </option>
      ))}
    </select>
  );
}
