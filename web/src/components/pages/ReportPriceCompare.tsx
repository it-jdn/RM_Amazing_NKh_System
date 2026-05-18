"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/client";
import { useLocale } from "@/context/LocaleContext";
import { fmt, formatAppDate } from "@/lib/utils/format";

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
}) {
  const { locale } = useLocale();
  const [priceHistory, setPriceHistory] = useState<PriceHistRow[]>([]);
  const [intakePoints, setIntakePoints] = useState<IntakePoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!props.active) return;
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

  if (!props.active || !loaded) return null;

  const unitChanges = new Map<string, string>();
  intakePoints.forEach((p) => {
    const key = `${p.itemCode}|${p.suppCode}`;
    const label = `${p.mainUnit} → ${p.subUnit} (×${p.convertRate})`;
    const prev = unitChanges.get(key);
    if (prev && prev !== label) {
      unitChanges.set(key, `${prev} → ${label}`);
    } else if (!prev) {
      unitChanges.set(key, label);
    }
  });

  return (
    <div className="card">
      <div className="card-title">
        <span className="dot dot-orange" />
        <span>เปรียบเทียบราคาและหน่วย (ประวัติ)</span>
      </div>

      {priceHistory.length > 0 && (
        <>
          <p className="lbl" style={{ marginBottom: 8 }}>
            ประวัติราคามาตรฐาน / ราคารับล่าสุด
          </p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ร้าน</th>
                  <th>สินค้า</th>
                  <th>ประเภท</th>
                  <th>แหล่ง</th>
                  <th>ราคา/หน่วย (₩)</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((r) => (
                  <tr key={r.id}>
                    <td>{r.recordedAt.slice(0, 10)}</td>
                    <td>{r.suppCode}</td>
                    <td>{r.itemCode}</td>
                    <td>{r.priceKind === "standard" ? "มาตรฐาน" : "รับล่าสุด"}</td>
                    <td>{r.source === "manual" ? "ตั้งค่า" : "รับสินค้า"}</td>
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
            ราคาจริงต่อครั้งที่รับ (จาก snapshot)
          </p>
          <div className="tbl-scroll">
            <table className="dtbl">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>สินค้า</th>
                  <th>หน่วย</th>
                  <th>ราคามาตรฐาน ณ วันรับ</th>
                  <th>ราคา/หน่วย จริง</th>
                  <th>ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                {intakePoints.slice(-100).map((p, i) => (
                  <tr key={`${p.date}-${p.itemCode}-${i}`}>
                    <td>{formatAppDate(p.date, locale)}</td>
                    <td>
                      <b>{p.itemNameTH}</b>
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

      {[...unitChanges.entries()].filter(([, v]) => v.includes("→") && v.split("→").length > 2).length >
        0 && (
        <p style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
          ตรวจพบการเปลี่ยนหน่วยในช่วงที่เลือก — ดูคอลัมน์หน่วยในตารางด้านบน
        </p>
      )}

      {!priceHistory.length && !intakePoints.length && (
        <p className="empty">ไม่มีข้อมูลเปรียบเทียบในช่วงที่เลือก</p>
      )}
    </div>
  );
}
