"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/context/LocaleContext";

type Props = {
  title: string;
  dot?: "orange" | "blue" | "green" | "purple";
  onExportExcel?: () => void;
  exportDisabled?: boolean;
  children: ReactNode;
};

export function ReportTableSection({
  title,
  dot = "orange",
  onExportExcel,
  exportDisabled,
  children,
}: Props) {
  const { t } = useLocale();
  return (
    <div className="card report-table-section">
      <div className="card-title report-table-section__head">
        <span className={`dot dot-${dot}`} />
        <span className="report-table-section__title">{title}</span>
        {onExportExcel ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm report-table-section__export no-print"
            disabled={exportDisabled}
            onClick={onExportExcel}
          >
            {t("report.exportExcel")}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
