"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useAppData } from "@/context/AppDataContext";
import { useLocale } from "@/context/LocaleContext";
import {
  FALLBACK_ITEM_CATEGORIES,
  itemCategoryDisplayName,
} from "@/lib/catalog/item-categories";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { apiGet } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { AppDateField } from "@/components/ui/AppDateField";
import { daysAgoISO, fmt, formatAppDate, todayISO } from "@/lib/utils/format";
import { ReportPriceCompare } from "@/components/pages/ReportPriceCompare";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ReportData {
  success: boolean;
  summary: { totalCost: number; totalTrans: number };
  byCategory: {
    categoryCode: string;
    categoryNameTH: string;
    totalPrice: number;
    count: number;
    distinctItems: number;
  }[];
  itemCategories?: {
    code: string;
    nameTH: string;
    nameEN: string;
    nameKR: string;
    sortOrder: number;
  }[];
  byItem: { itemName: string; qty: number; count: number; totalPrice: number }[];
  byDate: { date: string; totalPrice: number; count: number }[];
  rows: {
    no?: number;
    date: string;
    suppName: string;
    suppCode: string;
    itemNameTH: string;
    qty: number;
    mainUnit: string;
    totalPrice: number;
  }[];
}

export function ReportView() {
  const { suppliers, items, itemCategories: categoriesFromApi } = useAppData();
  const itemCategories = categoriesFromApi.length ? categoriesFromApi : FALLBACK_ITEM_CATEGORIES;
  const { locale, t } = useLocale();
  const toast = useToast();
  const [rFrom, setRFrom] = useState(daysAgoISO(30));
  const [rTo, setRTo] = useState(todayISO());
  const [rSupp, setRSupp] = useState("");
  const [rItem, setRItem] = useState("");
  const [rCategory, setRCategory] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const reportCategories =
    data?.itemCategories?.length ? data.itemCategories : itemCategories;

  const itemOptions = useMemo(() => {
    if (!rCategory) return items;
    return items.filter((i) => i.categoryCode === rCategory);
  }, [items, rCategory]);

  async function loadReport() {
    try {
      const params = new URLSearchParams();
      if (rFrom) params.set("dateFrom", rFrom);
      if (rTo) params.set("dateTo", rTo);
      if (rSupp) params.set("suppCode", rSupp);
      if (rItem) params.set("itemCode", rItem);
      if (rCategory) params.set("categoryCode", rCategory);
      const d = await apiGet<ReportData>(`/api/reports?${params}`);
      if (!d.success) {
        toast("โหลดรายงานผิดพลาด");
        return;
      }
      setData(d);
      setShowCompare(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    }
  }

  const chartData = data
    ? {
        labels: data.byDate.map((x) => formatAppDate(x.date, locale)),
        datasets: [
          {
            label: "มูลค่า",
            data: data.byDate.map((x) => x.totalPrice),
            backgroundColor: "rgba(26,107,181,.45)",
            borderColor: "rgba(26,107,181,.9)",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }
    : null;

  const categoryChartData = data?.byCategory.length
    ? {
        labels: data.byCategory.map((row) => {
          const cat = reportCategories.find((c) => c.code === row.categoryCode);
          return cat ? itemCategoryDisplayName(cat, locale) : row.categoryNameTH;
        }),
        datasets: [
          {
            label: "มูลค่า",
            data: data.byCategory.map((x) => x.totalPrice),
            backgroundColor: "rgba(232,66,26,.4)",
            borderColor: "rgba(232,66,26,.85)",
            borderWidth: 1.5,
            borderRadius: 4,
          },
        ],
      }
    : null;

  return (
    <div className="wrap">
      <div className="card">
        <div className="card-title">
          <span className="dot dot-purple" />
          <span>รายงานต้นทุนวัตถุดิบ</span>
        </div>
        <div className="form-row c5">
          <div>
            <label className="lbl">วันที่เริ่มต้น</label>
            <AppDateField id="report-from" value={rFrom} onChange={setRFrom} placeholder="วันที่เริ่มต้น" />
          </div>
          <div>
            <label className="lbl">วันที่สิ้นสุด</label>
            <AppDateField id="report-to" value={rTo} onChange={setRTo} placeholder="วันที่สิ้นสุด" />
          </div>
          <div>
            <label className="lbl">ร้านค้า</label>
            <select value={rSupp} onChange={(e) => setRSupp(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {suppliers.map((s) => (
                <option key={s.code} value={s.code}>
                  {supplierDisplayName(s, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">{t("report.category")}</label>
            <select
              value={rCategory}
              onChange={(e) => {
                const next = e.target.value;
                setRCategory(next);
                if (next && rItem) {
                  const item = items.find((i) => i.code === rItem);
                  if (item && item.categoryCode !== next) setRItem("");
                }
              }}
            >
              <option value="">{t("report.categoryAll")}</option>
              {(itemCategories.length ? itemCategories : reportCategories).map((c) => (
                <option key={c.code} value={c.code}>
                  {itemCategoryDisplayName(c, locale)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">สินค้า</label>
            <select value={rItem} onChange={(e) => setRItem(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {itemOptions.map((i) => (
                <option key={i.code} value={i.code}>
                  {i.nameTH}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={loadReport}>
          แสดงรายงาน
        </button>
      </div>

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="s-lbl">มูลค่ารวม (₩)</div>
              <div className="s-val">₩{fmt(data.summary.totalCost)}</div>
            </div>
            <div className="stat-card">
              <div className="s-lbl">จำนวนรายการ</div>
              <div className="s-val">{data.summary.totalTrans}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="dot dot-orange" />
              <span>{t("report.byCategory")}</span>
            </div>
            {categoryChartData && (
              <Bar
                data={categoryChartData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      ticks: {
                        callback: (v) => "₩" + fmt(Number(v)),
                      },
                    },
                  },
                }}
              />
            )}
            <div className="tbl-scroll" style={{ marginTop: 16 }}>
              <table className="dtbl">
                <thead>
                  <tr>
                    <th>{t("report.category")}</th>
                    <th>{t("report.categoryItems")}</th>
                    <th>{t("report.categoryTrans")}</th>
                    <th>มูลค่า (₩)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.length ? (
                    data.byCategory.map((row) => {
                      const cat = reportCategories.find((c) => c.code === row.categoryCode);
                      const label = cat
                        ? itemCategoryDisplayName(cat, locale)
                        : row.categoryNameTH;
                      return (
                        <tr key={row.categoryCode}>
                          <td>
                            <b>{label}</b>
                          </td>
                          <td>{row.distinctItems}</td>
                          <td>{row.count}</td>
                          <td className="gval">₩{fmt(row.totalPrice)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="dot dot-purple" />
              <span>แนวโน้มมูลค่ารายวัน</span>
            </div>
            {chartData && (
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: {
                      ticks: {
                        callback: (v) => "₩" + fmt(Number(v)),
                      },
                    },
                  },
                }}
              />
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <span className="dot dot-blue" />
              <span>สรุปตามสินค้า</span>
            </div>
            <div className="tbl-scroll">
              <table className="dtbl">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>รายการ</th>
                    <th>มูลค่า (₩)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byItem.length ? (
                    data.byItem.map((x) => (
                      <tr key={x.itemName}>
                        <td>
                          <b>{x.itemName}</b>
                        </td>
                        <td className="gval">{fmt(x.qty)}</td>
                        <td>{x.count}</td>
                        <td className="gval">₩{fmt(x.totalPrice)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span className="dot dot-green" />
              <span>รายการล่าสุด (300)</span>
            </div>
            <div className="tbl-scroll">
              <table className="dtbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>วันที่</th>
                    <th>ร้านค้า</th>
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>มูลค่า (₩)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length ? (
                    data.rows.map((r) => (
                      <tr key={`${r.no}-${r.date}-${r.itemNameTH}`}>
                        <td style={{ color: "var(--muted)", fontFamily: "IBM Plex Mono, monospace" }}>
                          {r.no}
                        </td>
                        <td>{formatAppDate(r.date, locale)}</td>
                        <td>{r.suppName || r.suppCode}</td>
                        <td>
                          <b>{r.itemNameTH}</b>
                        </td>
                        <td style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                          {fmt(r.qty)} {r.mainUnit}
                        </td>
                        <td className="gval">₩{fmt(r.totalPrice)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ReportPriceCompare
            dateFrom={rFrom}
            dateTo={rTo}
            suppCode={rSupp}
            itemCode={rItem}
            active={showCompare}
          />
        </>
      )}
    </div>
  );
}
