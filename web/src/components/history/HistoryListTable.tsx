"use client";

import { useLocale } from "@/context/LocaleContext";
import { supplierDisplayNameByCode } from "@/lib/i18n/supplier-name";
import type { Supplier } from "@/lib/types";
import type { HistoryListGroup } from "@/lib/domain/history-list-groups";
import { fmt, formatAppDate, formatAppDateTime } from "@/lib/utils/format";

type Props = {
  rows: HistoryListGroup[];
  suppliers: Supplier[];
  onOpen: (row: HistoryListGroup) => void;
};

export function HistoryListTable({ rows, suppliers, onOpen }: Props) {
  const { locale, t } = useLocale();

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
          <thead>
            <tr>
              <th scope="col">{t("intake.date")}</th>
              <th scope="col">{t("hist.supplier")}</th>
              <th scope="col" className="hist-list-table__th-num">
                {t("hist.listColLines")}
              </th>
              <th scope="col" className="hist-list-table__th-num">
                {t("hist.summaryTotal")}
              </th>
              <th scope="col">{t("hist.savedBy")}</th>
              <th scope="col">{t("hist.savedAt")}</th>
              <th scope="col">{t("hist.updatedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const savedBy = g.savedByName?.trim() || t("hist.savedByUnknown");
              const savedAtText = g.savedAt ? formatAppDateTime(g.savedAt, locale) : "—";
              const updatedAtText = g.updatedAt ? formatAppDateTime(g.updatedAt, locale) : "—";
              const updatedByNote =
                g.updatedAt && g.updatedByName?.trim()
                  ? g.updatedByName.trim()
                  : null;

              return (
              <tr
                key={g.date + g.suppCode}
                className="hist-list-table__row"
                role="button"
                tabIndex={0}
                onClick={() => onOpen(g)}
                onKeyDown={(e) => onRowKeyDown(e, g)}
              >
                <td>{formatAppDate(g.date, locale)}</td>
                <td className="hist-list-table__shop">
                  {supplierDisplayNameByCode(g.suppCode, suppliers, locale, g.suppName)}
                </td>
                <td className="hist-list-table__num">{g.count}</td>
                <td className="hist-list-table__num hist-list-table__total">₩{fmt(g.total)}</td>
                <td className="hist-list-table__who">{savedBy}</td>
                <td className="hist-list-table__when">{savedAtText}</td>
                <td className="hist-list-table__when">
                  <span>{updatedAtText}</span>
                  {updatedByNote ? (
                    <span className="hist-list-table__when-sub">{updatedByNote}</span>
                  ) : null}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
