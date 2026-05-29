"use client";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useLocale } from "@/context/LocaleContext";
import { MobileDateField } from "@/components/operator/MobileDateField";
import { MobileSupplierPicker } from "@/components/operator/MobileSupplierPicker";
import type { Supplier } from "@/lib/types";

type Props = {
  intakeDate: string;
  setIntakeDate: (v: string) => void;
  suppSel: string;
  setSuppSel: (v: string) => void;
  suppliers: Supplier[];
};

/** วันที่ + ร้าน — แถวเดียว กระชับบนมือถือ */
export function IntakeMobileSetup({
  intakeDate,
  setIntakeDate,
  suppSel,
  setSuppSel,
  suppliers,
}: Props) {
  const { t } = useLocale();

  return (
    <div className="intake-mobile-setup intake-mobile-setup--compact">
      <MobileDateField value={intakeDate} onChange={setIntakeDate} />
      <div className="intake-supplier-field">
        <MobileSupplierPicker
          value={suppSel}
          onChange={setSuppSel}
          suppliers={suppliers}
          placeholder={t("intake.selectSupplier")}
        />
      </div>
      <div className="intake-mobile-setup__lang">
        <LocaleSwitcher variant="menu" />
      </div>
    </div>
  );
}
