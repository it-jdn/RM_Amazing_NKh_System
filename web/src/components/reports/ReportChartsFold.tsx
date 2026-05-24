"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/context/LocaleContext";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";

type Props = {
  children: ReactNode;
};

export function ReportChartsFold({ children }: Props) {
  const isPhone = usePhoneLayout();
  const { t } = useLocale();

  return (
    <details className="report-charts-fold" open={!isPhone}>
      <summary className="report-charts-fold__summary">{t("report.chartsSection")}</summary>
      <div className="report-charts-fold__body">{children}</div>
    </details>
  );
}
