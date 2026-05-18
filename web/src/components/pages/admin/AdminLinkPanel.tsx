"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiGet, apiPost } from "@/lib/api/client";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/context/LocaleContext";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import { AdminCardTitle, AdminItemForm } from "@/components/pages/admin/admin-shared";
import type { UnitOption, UnitPairHint } from "@/lib/types";

export function AdminLinkPanel() {
  const { suppliers, reload } = useAppData();
  const { locale, t } = useLocale();
  const toast = useToast();
  const [aSupp, setASupp] = useState("");
  const [aNameTH, setANameTH] = useState("");
  const [aNameEN, setANameEN] = useState("");
  const [aNameKR, setANameKR] = useState("");
  const [aMain, setAMain] = useState("");
  const [aSub, setASub] = useState("");
  const [aConv, setAConv] = useState("1");
  const [aPrice, setAPrice] = useState("");
  const [mainUnits, setMainUnits] = useState<UnitOption[]>([]);
  const [subUnits, setSubUnits] = useState<UnitOption[]>([]);
  const [pairHints, setPairHints] = useState<UnitPairHint[]>([]);
  const [rebuilding, setRebuilding] = useState(false);

  const loadUnits = useCallback(async () => {
    try {
      const [mainRes, subRes] = await Promise.all([
        apiGet<{ success: boolean; units: UnitOption[] }>("/api/units?kind=main"),
        apiGet<{ success: boolean; units: UnitOption[] }>("/api/units?kind=sub"),
      ]);
      if (mainRes.success) setMainUnits(mainRes.units);
      if (subRes.success) setSubUnits(subRes.units);
    } catch {
      /* units table may be empty before rebuild */
    }
  }, []);

  const loadPairs = useCallback(async () => {
    if (!aMain) {
      setPairHints([]);
      return;
    }
    const params = new URLSearchParams({ mainUnitCode: aMain });
    if (aSupp) params.set("suppCode", aSupp);
    try {
      const res = await apiGet<{ success: boolean; pairs: UnitPairHint[] }>(
        `/api/units/pairs?${params}`
      );
      if (res.success) setPairHints(res.pairs);
    } catch {
      setPairHints([]);
    }
  }, [aMain, aSupp]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadPairs();
  }, [loadPairs]);

  async function addItem() {
    if (!aSupp || !aNameTH || !aMain || !aSub) {
      toast(t("admin.fillRequired"));
      return;
    }
    const mainU = mainUnits.find((u) => u.unitCode === aMain);
    const subU = subUnits.find((u) => u.unitCode === aSub);
    const mainLabel = mainU ? unitDisplayName(mainU, locale) : aMain;
    const subLabel = subU ? unitDisplayName(subU, locale) : aSub;
    try {
      const r = await apiPost<{ message: string }>("/api/items", {
        suppCode: aSupp,
        itemNameTH: aNameTH,
        itemNameEN: aNameEN,
        itemNameKR: aNameKR,
        mainUnitCode: aMain,
        subUnitCode: aSub,
        mainUnit: mainLabel,
        subUnit: subLabel,
        convertRate: aConv,
        unitPrice: aPrice,
      });
      toast(r.message);
      setANameTH("");
      setANameEN("");
      setANameKR("");
      setAMain("");
      setASub("");
      setAConv("1");
      setAPrice("");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    }
  }

  async function rebuildUnits() {
    setRebuilding(true);
    try {
      const r = await apiPost<{ message: string }>("/api/admin/units/rebuild", {});
      toast(r.message);
      await loadUnits();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="card">
      <AdminCardTitle title={t("admin.link.title")} />
      <p className="admin-hint" style={{ marginBottom: 12, fontSize: 13, opacity: 0.85 }}>
        {t("admin.link.unitsFromHistory")}
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ marginBottom: 16 }}
        disabled={rebuilding}
        onClick={rebuildUnits}
      >
        {rebuilding ? t("admin.link.rebuildingUnits") : t("admin.link.rebuildUnits")}
      </button>
      <AdminItemForm
        suppliers={suppliers}
        locale={locale}
        aSupp={aSupp}
        setASupp={setASupp}
        aNameTH={aNameTH}
        setANameTH={setANameTH}
        aNameEN={aNameEN}
        setANameEN={setANameEN}
        aNameKR={aNameKR}
        setANameKR={setANameKR}
        aMain={aMain}
        setAMain={setAMain}
        aSub={aSub}
        setASub={setASub}
        aConv={aConv}
        setAConv={setAConv}
        aPrice={aPrice}
        setAPrice={setAPrice}
        mainUnits={mainUnits}
        subUnits={subUnits}
        pairHints={pairHints}
        onAdd={addItem}
        labels={{
          shop: t("admin.link.shop"),
          nameTh: t("admin.link.nameTh"),
          nameEn: t("admin.link.nameEn"),
          nameKr: t("admin.link.nameKr"),
          mainUnit: t("admin.link.mainUnit"),
          subUnit: t("admin.link.subUnit"),
          convert: t("admin.link.convert"),
          unitPrice: t("admin.link.unitPrice"),
          submit: t("admin.link.submit"),
          select: t("admin.link.select"),
        }}
      />
    </div>
  );
}
