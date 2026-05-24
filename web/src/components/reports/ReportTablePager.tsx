"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/context/LocaleContext";

export type ReportPageSize = 50 | 100 | "all";

export function useReportTablePaging(totalRows: number, defaultPageSize: ReportPageSize = 50) {
  const [pageSize, setPageSize] = useState<ReportPageSize>(defaultPageSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [totalRows, pageSize]);

  const chunk = pageSize === "all" ? totalRows : pageSize;
  const totalPages =
    pageSize === "all" || totalRows === 0 ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const offset = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;
  const limit = pageSize === "all" ? totalRows : pageSize;
  const from = totalRows === 0 ? 0 : offset + 1;
  const to = totalRows === 0 ? 0 : Math.min(offset + limit, totalRows);

  return {
    pageSize,
    setPageSize,
    page: currentPage,
    setPage,
    totalPages,
    offset,
    limit,
    from,
    to,
  };
}

type Props = {
  totalRows: number;
  pageSize: ReportPageSize;
  page: number;
  totalPages: number;
  from: number;
  to: number;
  onPageSizeChange: (size: ReportPageSize) => void;
  onPageChange: (page: number) => void;
};

export function ReportTablePager({
  totalRows,
  pageSize,
  page,
  totalPages,
  from,
  to,
  onPageSizeChange,
  onPageChange,
}: Props) {
  const { t } = useLocale();

  if (totalRows <= 50) return null;

  return (
    <div className="report-pagination no-print">
      <label className="report-pagination__size">
        <span className="report-pagination__size-label">{t("report.rowsPerPage")}</span>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value;
            onPageSizeChange(v === "all" ? "all" : (Number(v) as 50 | 100));
          }}
          aria-label={t("report.rowsPerPage")}
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="all">{t("report.showAll")}</option>
        </select>
      </label>
      <span className="report-pagination__range">
        {t("report.showingRows", { from, to, total: totalRows })}
      </span>
      {pageSize !== "all" && totalPages > 1 ? (
        <div className="report-pagination__nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t("report.prevPage")}
          </button>
          <span className="report-pagination__page">
            {t("report.page")} {page} {t("report.of")} {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t("report.nextPage")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
