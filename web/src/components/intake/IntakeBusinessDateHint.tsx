"use client";

import { useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import {
  browserCalendarTodayISO,
  formatAppDate,
  todayBangkokISO,
} from "@/lib/utils/format";

type Props = {
  intakeDate: string;
  onSelectDate: (iso: string) => void;
};

/** อธิบายว่าวันที่รับสินค้าตามเวลาไทย — ช่วยเมื่อล็อกอินจากต่างประเทศ (เช่น เกาหลี) */
export function IntakeBusinessDateHint({ intakeDate, onSelectDate }: Props) {
  const { locale, t } = useLocale();
  const businessToday = useMemo(() => todayBangkokISO(), []);
  const localToday = useMemo(() => browserCalendarTodayISO(), []);
  const datesDiffer = localToday !== businessToday;

  return (
    <div className="intake-business-date-hint" role="note">
      <p className="intake-business-date-hint__text">
        {datesDiffer
          ? t("intake.businessDateHintDiff", {
              businessDate: formatAppDate(businessToday, locale),
              localDate: formatAppDate(localToday, locale),
              selectedDate: formatAppDate(intakeDate, locale),
            })
          : t("intake.businessDateHintSame", {
              businessDate: formatAppDate(businessToday, locale),
            })}
      </p>
      <div className="intake-business-date-hint__actions">
        {intakeDate !== businessToday ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onSelectDate(businessToday)}
          >
            {t("intake.businessDateUseThaiToday")}
          </button>
        ) : null}
        {datesDiffer && intakeDate !== localToday ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onSelectDate(localToday)}
          >
            {t("intake.businessDateUseLocalToday")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
