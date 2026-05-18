"use client";

import { useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiPatch } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { AdminCardTitle, MiName } from "@/components/pages/admin/admin-shared";

export function AdminPricesPanel() {
  const { suppliers, items, mapping, reload } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();
  const [filtSupp, setFiltSupp] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});

  const maps = filtSupp ? mapping.filter((m) => m.suppCode === filtSupp) : mapping;

  async function savePrice(suppCode: string, itemCode: string) {
    const key = `${suppCode}-${itemCode}`;
    const val =
      prices[key] ?? String(maps.find((m) => m.suppCode === suppCode && m.itemCode === itemCode)?.unitPrice ?? "");
    try {
      const r = await apiPatch<{ message: string }>("/api/mapping/price", {
        suppCode,
        itemCode,
        newPrice: val,
      });
      toast(r.message);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="card">
      <AdminCardTitle title={t("admin.prices.title")} dot="blue" />
      <div className="form-row" style={{ maxWidth: 320 }}>
        <div>
          <label className="lbl">{t("admin.prices.filter")}</label>
          <select value={filtSupp} onChange={(e) => setFiltSupp(e.target.value)}>
            <option value="">{t("admin.prices.allShops")}</option>
            {suppliers.map((s) => (
              <option key={s.code} value={s.code}>
                {supplierDisplayName(s, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!maps.length ? (
        <div className="empty">{t("admin.prices.empty")}</div>
      ) : (
        maps.map((m) => {
          const it = items.find((i) => i.code === m.itemCode);
          const sp = suppliers.find((s) => s.code === m.suppCode);
          const spLabel = sp ? supplierDisplayName(sp, locale) : m.suppCode;
          const key = `${m.suppCode}-${m.itemCode}`;
          const val = prices[key] ?? String(m.unitPrice);
          return (
            <div key={key} className="mi-row">
              <div className="mi-info">
                <MiName name={it?.nameTH || m.itemCode} />
                <div className="mi-sub">
                  {spLabel} · {it?.unit || ""}
                </div>
              </div>
              <div className="price-edit">
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setPrices({ ...prices, [key]: e.target.value })}
                />
                <button type="button" className="btn-xs" onClick={() => savePrice(m.suppCode, m.itemCode)}>
                  {t("admin.prices.save")}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
