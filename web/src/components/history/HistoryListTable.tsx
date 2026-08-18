"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { IconChevronDown, IconChevronUp, IconEdit } from "@/components/icons/AppIcons";
import { supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import type { Supplier } from "@/lib/types";
import type { HistoryListGroup } from "@/lib/domain/history-list-groups";
import type { HistoryListSortColumn, HistoryListSortState } from "@/lib/domain/history-list-sort";
import { fmt, formatAppDate, formatAppDateTime, getAppDayOfWeekLabel, parseISODateLocal } from "@/lib/utils/format";

type Props = {
  rows: HistoryListGroup[];
  rowOffset?: number;
  suppliers: Supplier[];
  sort: HistoryListSortState;
  onSortColumn: (column: HistoryListSortColumn) => void;
  onOpen: (row: HistoryListGroup) => void;
};

type EditCellProps = {
  rowKey: string;
  updatedAt: string | null;
  updatedByName: string | null;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
};

type SortThProps = {
  column: HistoryListSortColumn;
  label: string;
  className?: string;
  alignEnd?: boolean;
  sort: HistoryListSortState;
  onSortColumn: (column: HistoryListSortColumn) => void;
};

function HistorySortTh({
  column,
  label,
  className,
  alignEnd,
  sort,
  onSortColumn,
}: SortThProps) {
  const { t } = useLocale();
  const active = sort.column === column;
  const orderLabel = sort.direction === "asc" ? t("intake.sort.asc") : t("intake.sort.desc");
  const ariaLabel = active
    ? t("intake.table.sortState", { column: label, order: orderLabel })
    : t("intake.table.sortHint", { column: label });

  return (
    <th
      className={`itbl__th-sort ${className ?? ""}${alignEnd ? " itbl__th-sort--end" : ""}`.trim()}
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`itbl__sort-btn${active ? " itbl__sort-btn--active" : ""}`}
        aria-label={ariaLabel}
        onClick={() => onSortColumn(column)}
      >
        <span className="itbl__sort-btn__label">{label}</span>
        {active ? (
          sort.direction === "asc" ? (
            <IconChevronUp size={14} className="itbl__sort-btn__icon" aria-hidden />
          ) : (
            <IconChevronDown size={14} className="itbl__sort-btn__icon" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

function HistoryEditTimeCell({
  rowKey,
  updatedAt,
  updatedByName,
  openKey,
  setOpenKey,
}: EditCellProps) {
  const { locale, t } = useLocale();
  const cellRef = useRef<HTMLTableCellElement>(null);
  const isOpen = openKey === rowKey;

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen, setOpenKey]);

  if (!updatedAt) {
    return <td className="hist-list-table__edit" />;
  }

  const updatedBy = updatedByName?.trim() || null;

  return (
    <td className="hist-list-table__edit" ref={cellRef}>
      <button
        type="button"
        className="hist-list-table__edit-btn"
        aria-label={t("hist.viewEditTime")}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setOpenKey(isOpen ? null : rowKey);
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <IconEdit size={16} aria-hidden />
      </button>
      {isOpen ? (
        <div
          className="hist-list-table__edit-popover"
          role="dialog"
          aria-label={t("hist.updatedAt")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hist-list-table__edit-popover-row">
            <span className="hist-list-table__edit-popover-label">{t("hist.updatedAt")}</span>
            <span>{formatAppDateTime(updatedAt, locale)}</span>
          </div>
          {updatedBy ? (
            <div className="hist-list-table__edit-popover-row">
              <span className="hist-list-table__edit-popover-label">{t("hist.updatedBy")}</span>
              <span>{updatedBy}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </td>
  );
}

function HistoryUpdatedSortTh({
  sort,
  onSortColumn,
}: {
  sort: HistoryListSortState;
  onSortColumn: (column: HistoryListSortColumn) => void;
}) {
  const { t } = useLocale();
  const active = sort.column === "updatedAt";
  const orderLabel = sort.direction === "asc" ? t("intake.sort.asc") : t("intake.sort.desc");
  const label = t("hist.updatedAt");
  const ariaLabel = active
    ? t("intake.table.sortState", { column: label, order: orderLabel })
    : t("intake.table.sortHint", { column: label });

  return (
    <th
      className="itbl__th-sort hist-list-table__th-edit"
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={`itbl__sort-btn hist-list-table__edit-sort-btn${active ? " itbl__sort-btn--active" : ""}`}
        aria-label={ariaLabel}
        onClick={() => onSortColumn("updatedAt")}
      >
        <IconEdit size={14} className="itbl__sort-btn__icon" aria-hidden />
        {active ? (
          sort.direction === "asc" ? (
            <IconChevronUp size={14} className="itbl__sort-btn__icon" aria-hidden />
          ) : (
            <IconChevronDown size={14} className="itbl__sort-btn__icon" aria-hidden />
          )
        ) : null}
        <span className="sr-only">{label}</span>
      </button>
    </th>
  );
}

export function HistoryListTable({ rows, rowOffset = 0, suppliers, sort, onSortColumn, onOpen }: Props) {
  const { locale, t } = useLocale();
  const [openEditKey, setOpenEditKey] = useState<string | null>(null);

  function onRowKeyDown(e: React.KeyboardEvent, row: HistoryListGroup) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row);
    }
  }

  return (
    <div className="hist-list-table-wrap">
      <div className="tbl-scroll hist-list-table-scroll">
        <table className="itbl hist-list-table">
          <colgroup>
            <col className="hist-list-table__col-seq" />
            <col className="hist-list-table__col-dow" />
            <col className="hist-list-table__col-date" />
            <col className="hist-list-table__col-shop" />
            <col className="hist-list-table__col-lines" />
            <col className="hist-list-table__col-total" />
            <col className="hist-list-table__col-who" />
            <col className="hist-list-table__col-when" />
            <col className="hist-list-table__col-edit" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="hist-list-table__th-seq">
                {t("intake.table.row")}
              </th>
              <th scope="col" className="hist-list-table__th-dow">
                {t("hist.listColWeekday")}
              </th>
              <HistorySortTh
                column="date"
                label={t("intake.date")}
                className="hist-list-table__th-date"
                sort={sort}
                onSortColumn={onSortColumn}
              />
              <HistorySortTh
                column="shop"
                label={t("hist.supplier")}
                className="hist-list-table__th-shop"
                sort={sort}
                onSortColumn={onSortColumn}
              />
              <HistorySortTh
                column="lines"
                label={t("hist.listColLines")}
                className="hist-list-table__th-lines"
                sort={sort}
                onSortColumn={onSortColumn}
              />
              <HistorySortTh
                column="total"
                label={t("hist.summaryTotal")}
                className="hist-list-table__th-num"
                alignEnd
                sort={sort}
                onSortColumn={onSortColumn}
              />
              <HistorySortTh
                column="savedBy"
                label={t("hist.receiver")}
                className="hist-list-table__th-who"
                sort={sort}
                onSortColumn={onSortColumn}
              />
              <HistorySortTh
                column="savedAt"
                label={t("hist.savedAt")}
                className="hist-list-table__th-when"
                sort={sort}
                onSortColumn={onSortColumn}
              />
              <HistoryUpdatedSortTh sort={sort} onSortColumn={onSortColumn} />
            </tr>
          </thead>
          <tbody>
            {rows.map((g, index) => {
              const rowKey = g.date + g.suppCode;
              const savedBy = g.savedByName?.trim() || t("hist.savedByUnknown");
              const savedAtText = g.savedAt ? formatAppDateTime(g.savedAt, locale) : "—";
              const dateObj = parseISODateLocal(g.date);
              const weekdayLabel = dateObj ? getAppDayOfWeekLabel(dateObj.getDay(), locale) : "—";

              return (
                <tr
                  key={rowKey}
                  className="hist-list-table__row"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(g)}
                  onKeyDown={(e) => onRowKeyDown(e, g)}
                >
                  <td className="hist-list-table__seq">{rowOffset + index + 1}</td>
                  <td className="hist-list-table__dow">{weekdayLabel}</td>
                  <td>{formatAppDate(g.date, locale)}</td>
                  <td className="hist-list-table__shop">
                    {supplierDisplayNameByCode(g.suppCode, suppliers, locale, g.suppName)}
                  </td>
                  <td className="hist-list-table__lines">{g.count}</td>
                  <td className="hist-list-table__num hist-list-table__total">₩{fmt(g.total)}</td>
                  <td className="hist-list-table__who">{savedBy}</td>
                  <td className="hist-list-table__when">{savedAtText}</td>
                  <HistoryEditTimeCell
                    rowKey={rowKey}
                    updatedAt={g.updatedAt}
                    updatedByName={g.updatedByName}
                    openKey={openEditKey}
                    setOpenKey={setOpenEditKey}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
