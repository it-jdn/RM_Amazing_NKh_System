"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import { purchaseUnitMainLabel } from "@/lib/domain/purchase-units";
import type { ItemPurchaseUnit } from "@/lib/types";

type Props = {
  options: ItemPurchaseUnit[];
  valueMainUnitCode: string;
  onChange: (mainUnitCode: string) => void;
  className?: string;
  disabled?: boolean;
};

function sortPurchaseOptions(options: ItemPurchaseUnit[]) {
  return [...options].sort(
    (a, b) =>
      (a.isDefault ? 0 : 1) - (b.isDefault ? 0 : 1) ||
      a.sortOrder - b.sortOrder ||
      a.mainUnit.localeCompare(b.mainUnit)
  );
}

type SuffixProps = {
  options: ItemPurchaseUnit[];
  valueMainUnitCode: string;
  onChange: (mainUnitCode: string) => void;
  disabled?: boolean;
};

/** หน่วยข้างช่องจำนวน — กดสลับเมื่อมีมากกว่า 1 ตัวเลือก */
export function IntakePurchaseUnitSuffix({
  options,
  valueMainUnitCode,
  onChange,
  disabled = false,
}: SuffixProps) {
  const { t } = useLocale();
  const sorted = useMemo(() => sortPurchaseOptions(options), [options]);
  const selected =
    sorted.find((o) => o.mainUnitCode === valueMainUnitCode) ?? sorted[0];
  const label = selected ? purchaseUnitMainLabel(selected) : "—";

  if (sorted.length <= 1) {
    return <span className="intake-field-block__suffix">{label}</span>;
  }

  function cycleUnit() {
    if (disabled) return;
    const idx = sorted.findIndex((o) => o.mainUnitCode === valueMainUnitCode);
    const next = sorted[(idx < 0 ? 0 : idx + 1) % sorted.length];
    onChange(next.mainUnitCode);
  }

  return (
    <button
      type="button"
      className="intake-field-block__suffix intake-field-block__suffix--pickable"
      onClick={cycleUnit}
      disabled={disabled}
      aria-label={t("intake.purchaseUnitCycle", { unit: label })}
      title={t("intake.purchaseUnitCycle", { unit: label })}
    >
      {label}
    </button>
  );
}

/** เลือกหน่วยซื้อเข้า — มากกว่า 1 ตัวเลือกใช้ dropdown */
export function IntakePurchaseUnitSelect({
  options,
  valueMainUnitCode,
  onChange,
  className,
  disabled = false,
}: Props) {
  const { t } = useLocale();

  const sorted = useMemo(() => sortPurchaseOptions(options), [options]);

  const selected =
    sorted.find((o) => o.mainUnitCode === valueMainUnitCode) ?? sorted[0];

  if (sorted.length <= 1) {
    const label = selected ? purchaseUnitMainLabel(selected) : "—";
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
          {purchaseUnitMainLabel(o)}
        </option>
      ))}
    </select>
  );
}
