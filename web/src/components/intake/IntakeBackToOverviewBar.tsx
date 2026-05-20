"use client";

import { IconChevronLeft } from "@/components/icons/AppIcons";

type Props = {
  label: string;
  onBack: () => void;
};

export function IntakeBackToOverviewBar({ label, onBack }: Props) {
  return (
    <nav className="intake-back-bar" aria-label={label}>
      <button type="button" className="intake-back-bar__btn" onClick={onBack}>
        <IconChevronLeft size={18} className="intake-back-bar__icon" aria-hidden />
        <span className="intake-back-bar__label">{label}</span>
      </button>
    </nav>
  );
}
