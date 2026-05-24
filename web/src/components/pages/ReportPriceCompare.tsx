"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { itemDisplayNameByCode } from "@/lib/i18n/item-name";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { fmt, formatAppDate } from "@/lib/utils/format";
import type { Item, Supplier } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface PriceHistRow {
  id: number;
  suppCode: string;
  itemCode: string;
  unitPrice: number;
  priceKind: string;
  source: string;
  recordedAt: string;
}

interface IntakePoint {
  date: string;
  suppCode: string;
  suppName?: string;
  itemCode: string;
  itemNameTH: string;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  unitPrice: number;
  standardPriceAtSave: number | null;
  totalPrice: number;
}

export function ReportPriceCompare(props: {
  dateFrom: string;
  dateTo: string;
  suppCode: string;
  itemCode: string;
  active: boolean;
  suppliers: Supplier[];
  items: Item[];
}) {
  const { locale, t } = useLocale();
  const [priceHistory, setPriceHistory] = useState<PriceHistRow[]>([]);
  const [intakePoints, setIntakePoints] = useState<IntakePoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!props.active) return;
    setLoaded(false);
    const params = new URLSearchParams();
    if (props.dateFrom) params.set("dateFrom", props.dateFrom);
    if (props.dateTo) params.set("dateTo", props.dateTo);
    if (props.suppCode) params.set("suppCode", props.suppCode);
    if (props.itemCode) params.set("itemCode", props.itemCode);

    apiGet<{
      success: boolean;
      priceHistory: PriceHistRow[];
      intakePoints: IntakePoint[];
    }>(`/api/reports/price-history?${params}`)
      .then((d) => {
        if (d.success) {
          setPriceHistory(d.priceHistory);
          setIntakePoints(d.intakePoints);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [props.active, props.dateFrom, props.dateTo, props.suppCode, props.itemCode]);

  const priceChart = useMemo(() => {
    const points = [...intakePoints].sort((a, b) => a.date.localeCompare(b.date));
    if (!points.length) return null;
    return {
      labels: points.map((p) => formatAppDate(p.date, locale)),
      datasets: [
        {
          label: t("report.intake"),
          data: points.map((p) => p.unitPrice),
          borderColor: "rgba(26,107,181,.95)",
          backgroundColor: "rgba(26,107,181,.2)",
          pointRadius: 4,
          tension: 0.2,
        },
        {
          label: t("report.standard"),
          data: points.map((p) => p.standardPriceAtSave ?? null),
          borderColor: "rgba(120,90,180,.85)",
          borderDash: [6, 4],
          pointRadius: 2,
          tension: 0.1,
        },
      ],
    };
  }, [intakePoints, locale, t]);

  function shopLabel(code: string) {
    const s = props.suppliers.find((x) => x.code === code);
    return s ? supplierDisplayName(s, locale) : code;
  }

  function itemLabel(code: string, snapshot?: string) {
    return itemDisplayNameByCode(code, props.items, locale, snapshot);
  }

  if (!props.active || !loaded) return null;

  return (
    <div className="card report-price-compare">
      <div className="card-title">
        <span className="dot dot-orange" />
        <span>{t("report.priceCompare")}</span>
      </div>

      {priceChart && (
        <>
          <p className="lbl" style={{ marginBottom: 8 }}>
            {t("report.priceTrend")}
          </p>
          <Line
            data={priceChart}
            options={{
              responsive: true,
              plugins: { legend: { position: "top" } },
              scales: {
                y: {
                  ticks: { callback: (v) => "₩" + fmt(Number(v)) },
                },
              },
            }}
          />
        </>
      )}

      {priceHistory.length > 0 && (
        <>
          <p className="lbl" style={{ margin: "16px 0 8px" }}>
            {t("report.priceHistory")}
          </p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>{t("report.dateFrom")}</th>
                  <th>{t("report.shop")}</th>
                  <th>{t("report.item")}</th>
                  <th>ประเภท</th>
                  <th>แหล่ง</th>
                  <th>ราคา/หน่วย (₩)</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((r) => (
                  <tr key={r.id}>
                    <td>{r.recordedAt.slice(0, 10)}</td>
                    <td>{shopLabel(r.suppCode)}</td>
                    <td>{r.itemCode}</td>
                    <td>
                      {r.priceKind === "standard"
                        ? t("report.standard")
                        : t("report.lastPurchase")}
                    </td>
                    <td>
                      {r.source === "manual" ? t("report.manual") : t("report.intake")}
                    </td>
                    <td className="gval">₩{fmt(r.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {intakePoints.length > 0 && (
        <>
          <p className="lbl" style={{ margin: "16px 0 8px" }}>
            {t("report.intakePrices")}
          </p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>{t("report.dateFrom")}</th>
                  <th>{t("report.item")}</th>
                  <th>หน่วย</th>
                  <th>{t("report.standard")}</th>
                  <th>{t("report.intake")}</th>
                  <th>{t("report.value")}</th>
                </tr>
              </thead>
              <tbody>
                {intakePoints.slice(-100).map((p, i) => (
                  <tr key={`${p.date}-${p.itemCode}-${i}`}>
                    <td>{formatAppDate(p.date, locale)}</td>
                    <td>
                      <b>{itemLabel(p.itemCode, p.itemNameTH)}</b>
                    </td>
                    <td>
                      {p.mainUnit} / {p.subUnit}
                    </td>
                    <td>
                      {p.standardPriceAtSave != null ? `₩${fmt(p.standardPriceAtSave)}` : "—"}
                    </td>
                    <td className="gval">₩{fmt(p.unitPrice)}</td>
                    <td className="gval">₩{fmt(p.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!priceHistory.length && !intakePoints.length && (
        <p className="empty">{t("report.noData")}</p>
      )}
    </div>
  );
}
