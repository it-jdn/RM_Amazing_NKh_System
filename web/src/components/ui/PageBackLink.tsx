"use client";

import { IconChevronLeft } from "@/components/icons/AppIcons";

type Props = {
  label: string;
  onClick: () => void;
  className?: string;
};

export function PageBackLink({ label, onClick, className }: Props) {
  return (
    <button
      type="button"
      className={`page-back${className ? ` ${className}` : ""}`}
      onClick={onClick}
    >
      <IconChevronLeft size={18} aria-hidden />
      <span className="page-back__label">{label}</span>
    </button>
  );
}
