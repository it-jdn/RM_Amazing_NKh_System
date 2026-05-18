"use client";

import { AppDateField } from "@/components/ui/AppDateField";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
};

/** @deprecated use AppDateField */
export function MobileDateField({ id = "intake-date-m", value, onChange }: Props) {
  const { t } = useLocale();
  return (
    <AppDateField
      id={id}
      value={value}
      onChange={onChange}
      placeholder={t("intake.date")}
      className="intake-mobile-setup__input--date"
      aria-label={t("intake.date")}
    />
  );
}
