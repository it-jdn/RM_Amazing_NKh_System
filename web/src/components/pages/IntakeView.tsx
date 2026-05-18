"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiGet, apiPost } from "@/lib/api/client";
import { IntakeSaveConfirmModal } from "@/components/intake/IntakeSaveConfirmModal";
import { IntakePurchaseUnitSelect } from "@/components/intake/IntakePurchaseUnitSelect";
import { IntakeSlipNoteBar } from "@/components/intake/IntakeSlipNoteModal";
import { IntakeItemCards } from "@/components/operator/IntakeItemCards";
import { IntakeMobileSetup } from "@/components/operator/IntakeMobileSetup";
import { IconX } from "@/components/icons/AppIcons";
import { IntakeStickyBar } from "@/components/operator/IntakeStickyBar";
import { useLocale } from "@/context/LocaleContext";
import { itemDisplayName, itemSecondaryName } from "@/lib/i18n/item-name";
import { sortSuppliersForPicker } from "@/lib/domain/supplier-sort";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { useToast } from "@/components/Toast";
import { intakeRowKey, parseIntakeRowKey } from "@/lib/domain/intake-row-key";
import { defaultPurchaseUnit, purchaseUnitsForItem } from "@/lib/domain/purchase-units";
import { aggregateTransactionsByItem } from "@/lib/domain/transactions";
import {
  cloneIntakeRowVals,
  hasIntakeRowInput,
  isIntakeRowValsDirty,
  type IntakeRowVals,
} from "@/lib/domain/intake-row-draft";
import { isServerSlipNewer, maxSavedAtFromRows } from "@/lib/domain/intake-slip";
import { extractSlipNoteFromRows } from "@/lib/domain/intake-slip-note";
import { IntakeDayOverview } from "@/components/intake/IntakeDayOverview";
import { IntakeSlipStatusBar, type IntakeSlipStatus } from "@/components/intake/IntakeSlipStatusBar";
import { IntakeStaleSaveModal } from "@/components/intake/IntakeStaleSaveModal";
import { IntakeUnsavedNavigateModal } from "@/components/intake/IntakeUnsavedNavigateModal";
import { UnitSelectFields } from "@/components/pages/admin/UnitSelectFields";
import { AppDateField } from "@/components/ui/AppDateField";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { UnitPairHint } from "@/lib/types";
import { useModalLayer } from "@/hooks/useModalLayer";
import { fmt, todayISO } from "@/lib/utils/format";
import {
  displayNumericField,
  loadedNumericField,
  sanitizeDecimalInput,
} from "@/lib/utils/numeric-input";
import type { Item, ItemPurchaseUnit, TransactionInput, TransactionRow } from "@/lib/types";

type CurItem = Item & {
  refPrice: number;
  rowKey: string;
  mainUnitCode: string;
  purchaseOptions: ItemPurchaseUnit[];
};

type PendingNav = { kind: "date"; value: string } | { kind: "supp"; value: string };

type SlipMetaResponse = {
  success: boolean;
  exists: boolean;
  maxSavedAt: string;
  savedByName: string;
  rowCount: number;
  productCount: number;
  hasDuplicateRows: boolean;
};

export function IntakeView() {
  const { suppliers, items, mapping, purchaseUnits, itemPurchaseStandards, units, reload, role } =
    useAppData();
  const activeSuppliers = useMemo(
    () => sortSuppliersForPicker(suppliers.filter((s) => s.active !== false)),
    [suppliers]
  );
  const { locale, t } = useLocale();
  const toast = useToast();
  const [intakeDate, setIntakeDate] = useState(todayISO());
  const [suppSel, setSuppSel] = useState("");
  const [search, setSearch] = useState("");
  const [rowVals, setRowVals] = useState<IntakeRowVals>({});
  const [selectedPurchaseUnit, setSelectedPurchaseUnit] = useState<Record<string, string>>({});
  const [slipNote, setSlipNote] = useState("");
  const [existingTxns, setExistingTxns] = useState<TransactionRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showUnsavedNav, setShowUnsavedNav] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const [baselineVals, setBaselineVals] = useState<IntakeRowVals>({});
  const [baselineSlipNote, setBaselineSlipNote] = useState("");
  const [slipSnapshotAt, setSlipSnapshotAt] = useState("");
  const [showStaleSave, setShowStaleSave] = useState(false);
  const [staleMeta, setStaleMeta] = useState({ maxSavedAt: "", savedByName: "" });
  const [reloadingSlip, setReloadingSlip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qa, setQa] = useState({
    nameTH: "",
    nameEN: "",
    nameKR: "",
    mainUnitCode: "",
    subUnitCode: "",
    conv: "1",
    price: "",
  });
  const [qaPairHints, setQaPairHints] = useState<UnitPairHint[]>([]);

  const qaMainUnits = useMemo(
    () =>
      [...units].sort(
        (a, b) => b.usageCountMain - a.usageCountMain || a.nameTH.localeCompare(b.nameTH, "th")
      ),
    [units]
  );
  const qaSubUnits = useMemo(() => {
    const hintScore = (code: string) =>
      qaPairHints.find((p) => p.subUnitCode === code)?.useCount ?? 0;
    return [...units].sort(
      (a, b) =>
        hintScore(b.unitCode) - hintScore(a.unitCode) ||
        b.usageCountSub - a.usageCountSub ||
        a.nameTH.localeCompare(b.nameTH, "th")
    );
  }, [units, qaPairHints]);

  const loadQaPairHints = useCallback(async () => {
    if (!qa.mainUnitCode) {
      setQaPairHints([]);
      return;
    }
    const params = new URLSearchParams({ mainUnitCode: qa.mainUnitCode });
    if (suppSel) params.set("suppCode", suppSel);
    try {
      const res = await apiGet<{ success: boolean; pairs: UnitPairHint[] }>(
        `/api/units/pairs?${params}`
      );
      if (res.success) setQaPairHints(res.pairs);
    } catch {
      setQaPairHints([]);
    }
  }, [qa.mainUnitCode, suppSel]);

  useEffect(() => {
    if (!showModal) return;
    setQa({
      nameTH: "",
      nameEN: "",
      nameKR: "",
      mainUnitCode: "",
      subUnitCode: "",
      conv: "1",
      price: "",
    });
    setQaPairHints([]);
  }, [showModal]);

  useEffect(() => {
    if (showModal) void loadQaPairHints();
  }, [showModal, loadQaPairHints]);

  useModalLayer({ open: showModal, onClose: () => setShowModal(false) });

  const curItems: CurItem[] = useMemo(() => {
    if (!suppSel) return [];
    const codes = new Set<string>();
    mapping.filter((m) => m.suppCode === suppSel).forEach((m) => codes.add(m.itemCode));
    purchaseUnits.filter((p) => p.suppCode === suppSel).forEach((p) => codes.add(p.itemCode));
    return items.filter((i) => codes.has(i.code)).flatMap((i) => {
      const mp = mapping.find((m) => m.suppCode === suppSel && m.itemCode === i.code);
      const options = purchaseUnitsForItem(
        purchaseUnits,
        itemPurchaseStandards,
        suppSel,
        i.code,
        mp
      );

      function rowForUnit(selected: ItemPurchaseUnit | undefined): CurItem {
        if (!selected) {
          return {
            ...i,
            purchaseOptions: options,
            mainUnitCode: "",
            unit: mp?.mainUnit || i.unit,
            subUnit: mp?.subUnit || i.subUnit,
            convertRate: mp?.convertRate ?? i.convertRate,
            refPrice: mp?.standardUnitPrice ?? mp?.unitPrice ?? 0,
            rowKey: intakeRowKey(i.code, mp?.mainUnit || i.unit),
          };
        }
        return {
          ...i,
          purchaseOptions: options,
          mainUnitCode: selected.mainUnitCode,
          unit: selected.mainUnit,
          subUnit: selected.subUnit,
          convertRate: selected.convertRate,
          refPrice: selected.standardUnitPrice ?? 0,
          rowKey: intakeRowKey(i.code, selected.mainUnit),
        };
      }

      const pickCode =
        selectedPurchaseUnit[i.code] ?? defaultPurchaseUnit(options)?.mainUnitCode ?? "";
      const selected =
        options.find((o) => o.mainUnitCode === pickCode) ??
        defaultPurchaseUnit(options) ??
        options[0];
      return [rowForUnit(selected)];
    });
  }, [suppSel, items, mapping, purchaseUnits, itemPurchaseStandards, selectedPurchaseUnit]);

  const loadExisting = useCallback(async () => {
    if (!suppSel || !intakeDate) return;
    try {
      const d = await apiGet<{ success: boolean; rows: TransactionRow[] }>(
        `/api/transactions?dateFrom=${intakeDate}&dateTo=${intakeDate}&suppCode=${suppSel}`
      );
      if (!d.success) return;
      const rows = d.rows.map((r) => ({
        date: r.date,
        suppCode: r.suppCode,
        suppName: r.suppName,
        itemCode: r.itemCode,
        itemNameTH: r.itemNameTH,
        qty: r.qty,
        mainUnit: r.mainUnit,
        unitPrice: r.unitPrice,
        totalPrice: r.totalPrice,
        note: r.note || "",
        savedAt: r.savedAt,
        savedByName: r.savedByName,
      }));
      setExistingTxns(rows as TransactionRow[]);
      const aggregated = aggregateTransactionsByItem(rows as TransactionRow[]);
      const vals: IntakeRowVals = {};
      const unitPick: Record<string, string> = {};
      aggregated.forEach((t) => {
        const key = intakeRowKey(t.itemCode, String(t.mainUnit || "").trim());
        vals[key] = {
          qty: loadedNumericField(t.qty),
          total: loadedNumericField(t.totalPrice),
        };
        const mp = mapping.find((m) => m.suppCode === suppSel && m.itemCode === t.itemCode);
        const options = purchaseUnitsForItem(
          purchaseUnits,
          itemPurchaseStandards,
          suppSel,
          t.itemCode,
          mp
        );
        const match = options.find((o) => o.mainUnit === t.mainUnit);
        if (!match) return;
        const prevCode = unitPick[t.itemCode];
        const prevKey = prevCode
          ? intakeRowKey(
              t.itemCode,
              options.find((o) => o.mainUnitCode === prevCode)?.mainUnit ?? ""
            )
          : "";
        const prevFilled =
          prevKey && ((parseFloat(vals[prevKey]?.qty) || 0) > 0 || (parseFloat(vals[prevKey]?.total) || 0) > 0);
        const newFilled =
          (parseFloat(vals[key]?.qty) || 0) > 0 || (parseFloat(vals[key]?.total) || 0) > 0;
        if (!prevCode || (newFilled && !prevFilled) || match.isDefault) {
          unitPick[t.itemCode] = match.mainUnitCode;
        }
      });
      setSelectedPurchaseUnit(unitPick);
      const loadedNote = extractSlipNoteFromRows(rows as TransactionRow[]);
      setRowVals(vals);
      setBaselineVals(cloneIntakeRowVals(vals));
      setSlipNote(loadedNote);
      setBaselineSlipNote(loadedNote);
      setSlipSnapshotAt(maxSavedAtFromRows(rows as TransactionRow[]));
    } catch {
      /* ignore */
    }
  }, [suppSel, intakeDate, mapping, purchaseUnits, itemPurchaseStandards]);

  useEffect(() => {
    setRowVals({});
    setSelectedPurchaseUnit({});
    setSlipNote("");
    setExistingTxns([]);
    setBaselineVals({});
    setBaselineSlipNote("");
    setSlipSnapshotAt("");
    if (suppSel) loadExisting();
  }, [suppSel, intakeDate, loadExisting]);

  const isDirty = useMemo(() => {
    if (!suppSel) return false;
    if (slipNote.trim() !== baselineSlipNote.trim()) return true;
    return isIntakeRowValsDirty(rowVals, baselineVals);
  }, [suppSel, slipNote, baselineSlipNote, rowVals, baselineVals]);

  function requestNavigate(nav: PendingNav) {
    if (nav.kind === "date" && nav.value === intakeDate) return;
    if (nav.kind === "supp" && nav.value === suppSel) return;
    if (!suppSel || !isDirty) {
      if (nav.kind === "date") setIntakeDate(nav.value);
      else setSuppSel(nav.value);
      return;
    }
    setPendingNav(nav);
    setShowUnsavedNav(true);
  }

  function discardPendingNavigation() {
    const nav = pendingNav;
    setPendingNav(null);
    setShowUnsavedNav(false);
    if (!nav) return;
    if (nav.kind === "date") setIntakeDate(nav.value);
    else setSuppSel(nav.value);
  }

  const filteredItems = curItems.filter((it) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      it.nameTH.toLowerCase().includes(q) ||
      it.nameEN.toLowerCase().includes(q) ||
      it.nameKR.toLowerCase().includes(q) ||
      it.code.toLowerCase().includes(q)
    );
  });

  function setRow(rowKey: string, field: "qty" | "total", val: string) {
    const next = sanitizeDecimalInput(val);
    setRowVals((prev) => ({
      ...prev,
      [rowKey]: {
        qty: prev[rowKey]?.qty ?? "",
        total: prev[rowKey]?.total ?? "",
        [field]: next,
      },
    }));
  }

  function setPurchaseUnitForItem(itemCode: string, mainUnitCode: string) {
    setSelectedPurchaseUnit((prev) => ({ ...prev, [itemCode]: mainUnitCode }));
  }

  function calcUp(rowKey: string, cr: number) {
    const v = rowVals[rowKey];
    if (!v) return "—";
    const qty = parseFloat(v.qty) || 0;
    const total = parseFloat(v.total) || 0;
    if (qty > 0 && total > 0) return "₩" + fmt(total / qty);
    return "—";
  }

  const shopItemCodes = useMemo(() => new Set(curItems.map((it) => it.code)), [curItems]);

  function sumStats() {
    let n = 0;
    let t = 0;
    for (const [rowKey, v] of Object.entries(rowVals)) {
      const parsed = parseIntakeRowKey(rowKey);
      if (!parsed || !shopItemCodes.has(parsed.itemCode)) continue;
      const q = parseFloat(v.qty) || 0;
      const tot = parseFloat(v.total) || 0;
      if (q > 0 && tot > 0) {
        n++;
        t += tot;
      }
    }
    return { n, t };
  }

  const { n: sumCount, t: sumTotal } = sumStats();

  const formFilledCount = useMemo(() => {
    return filteredItems.filter((it) =>
      it.purchaseOptions.some((opt) => {
        const v = rowVals[intakeRowKey(it.code, opt.mainUnit)];
        if (!v) return false;
        const q = parseFloat(v.qty) || 0;
        const tot = parseFloat(v.total) || 0;
        return q > 0 && tot > 0;
      })
    ).length;
  }, [filteredItems, rowVals]);

  const existingProductCount = useMemo(() => {
    return aggregateTransactionsByItem(existingTxns).length;
  }, [existingTxns]);

  const lastAudit = useMemo(() => {
    if (!existingTxns.length) return null;
    let savedAt = "";
    let savedByName = "";
    for (const row of existingTxns) {
      if (row.savedAt && row.savedAt >= savedAt) {
        savedAt = row.savedAt;
        savedByName = row.savedByName || savedByName;
      }
    }
    return savedAt ? { savedAt, savedByName } : null;
  }, [existingTxns]);

  const slipStatus = useMemo((): IntakeSlipStatus => {
    if (existingTxns.length > 0) return isDirty ? "modified" : "saved";
    if (hasIntakeRowInput(rowVals) || slipNote.trim()) return "draft";
    return "new";
  }, [existingTxns.length, isDirty, rowVals, slipNote]);

  const hasDuplicateRows = existingTxns.length > existingProductCount;
  const slipProductCount = existingTxns.length > 0 ? existingProductCount : sumCount;

  async function fetchSlipMeta() {
    return apiGet<SlipMetaResponse>(
      `/api/transactions/slip-meta?date=${encodeURIComponent(intakeDate)}&suppCode=${encodeURIComponent(suppSel)}`
    );
  }

  async function checkStaleBeforeSave(onContinue: () => void) {
    if (!suppSel || !intakeDate) return;
    try {
      const meta = await fetchSlipMeta();
      if (meta.exists && isServerSlipNewer(meta.maxSavedAt, slipSnapshotAt)) {
        setStaleMeta({ maxSavedAt: meta.maxSavedAt, savedByName: meta.savedByName });
        setShowStaleSave(true);
        return;
      }
    } catch {
      /* proceed if check fails */
    }
    onContinue();
  }

  async function reloadLatest() {
    if (!suppSel) return;
    if (isDirty && !confirm(t("intake.reloadDiscardConfirm"))) return;
    setReloadingSlip(true);
    try {
      await loadExisting();
      toast(t("intake.toastReloaded"));
    } finally {
      setReloadingSlip(false);
    }
  }

  function buildTransactions(): TransactionInput[] {
    const supp = suppliers.find((s) => s.code === suppSel);
    const suppLabel = supp ? supplierDisplayName(supp, locale) : suppSel;
    const itemByCode = new Map(curItems.map((it) => [it.code, it]));
    const txns: TransactionInput[] = [];

    for (const [rowKey, v] of Object.entries(rowVals)) {
      const parsed = parseIntakeRowKey(rowKey);
      if (!parsed || !shopItemCodes.has(parsed.itemCode)) continue;
      const qty = parseFloat(v.qty) || 0;
      const total = parseFloat(v.total) || 0;
      if (qty <= 0 || total <= 0) continue;

      const base = itemByCode.get(parsed.itemCode);
      if (!base) continue;
      const opt = base.purchaseOptions.find((o) => o.mainUnit === parsed.mainUnit);
      const mainUnit = opt?.mainUnit ?? parsed.mainUnit;
      const subUnit = opt?.subUnit ?? base.subUnit;
      const convertRate = opt?.convertRate ?? base.convertRate;
      const refPrice = opt?.standardUnitPrice ?? base.refPrice;

      txns.push({
        date: intakeDate,
        suppCode: suppSel,
        suppName: suppLabel,
        itemCode: base.code,
        itemNameTH: base.nameTH,
        qty,
        mainUnit,
        convertRate,
        subUnit,
        unitPrice: qty > 0 && total > 0 ? total / qty : refPrice,
        totalPrice: total,
        standardUnitPriceAtSave: refPrice,
        note: slipNote.trim(),
      });
    }
    return txns;
  }

  function requestSave() {
    if (!intakeDate) {
      toast(t("intake.toastNeedDate"));
      return;
    }
    if (!buildTransactions().length) {
      toast(t("intake.toastNeedItem"));
      return;
    }
    void checkStaleBeforeSave(() => setShowSaveConfirm(true));
  }

  async function submit() {
    if (!intakeDate) {
      toast(t("intake.toastNeedDate"));
      return;
    }
    const txns = buildTransactions();
    if (!txns.length) {
      toast(t("intake.toastNeedItem"));
      return;
    }
    setSaving(true);
    try {
      const r = await apiPost<{ success: boolean; message: string; replaced?: boolean }>(
        "/api/transactions",
        { transactions: txns }
      );
      toast(`✅ ${r.replaced ? t("intake.toastUpdated") : r.message || t("intake.toastSaved")}`);
      setShowSaveConfirm(false);
      setShowStaleSave(false);
      const nav = pendingNav;
      setPendingNav(null);
      setShowUnsavedNav(false);
      setRowVals({});
      setSlipNote("");
      setExistingTxns([]);
      setBaselineVals({});
      setBaselineSlipNote("");
      setSlipSnapshotAt("");
      if (nav?.kind === "date") {
        setIntakeDate(nav.value);
        setSuppSel("");
      } else if (nav?.kind === "supp") {
        setSuppSel(nav.value);
      } else {
        setSuppSel("");
      }
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function quickAdd() {
    if (!qa.nameTH.trim() || !qa.mainUnitCode || !qa.subUnitCode) {
      toast(t("intake.toastQaRequired"));
      return;
    }
    const mainU = units.find((u) => u.unitCode === qa.mainUnitCode);
    const subU = units.find((u) => u.unitCode === qa.subUnitCode);
    if (!mainU || !subU) {
      toast(t("intake.toastQaRequired"));
      return;
    }
    try {
      const r = await apiPost<{ message: string }>("/api/items", {
        suppCode: suppSel,
        itemNameTH: qa.nameTH,
        itemNameEN: qa.nameEN,
        itemNameKR: qa.nameKR,
        mainUnitCode: qa.mainUnitCode,
        subUnitCode: qa.subUnitCode,
        mainUnit: unitDisplayName(mainU, locale),
        subUnit: unitDisplayName(subU, locale),
        convertRate: qa.conv,
        unitPrice: qa.price,
      });
      toast(r.message);
      setQa({
        nameTH: "",
        nameEN: "",
        nameKR: "",
        mainUnitCode: "",
        subUnitCode: "",
        conv: "1",
        price: "",
      });
      setShowModal(false);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error");
    }
  }

  const selectedSupp = suppliers.find((s) => s.code === suppSel);
  const shopName = selectedSupp ? supplierDisplayName(selectedSupp, locale) : suppSel;
  const wrapClass = `wrap intake-page${suppSel ? " wrap--with-sticky-save" : ""}`;

  return (
    <div className={wrapClass}>
      <div className="card intake-setup-card intake-desktop-only">
        <div className="card-title">
          <span className="dot dot-green" />
          <span>{t("intake.title")}</span>
        </div>
        <div className="form-row c2 intake-form-top">
          <div>
            <label className="lbl">{t("intake.date")}</label>
            <AppDateField
              id="intake-date"
              value={intakeDate}
              onChange={(v) => requestNavigate({ kind: "date", value: v })}
              placeholder={t("intake.date")}
              aria-label={t("intake.date")}
            />
          </div>
          <div>
            <label className="lbl">{t("intake.supplier")}</label>
            <select
              value={suppSel}
              onChange={(e) => requestNavigate({ kind: "supp", value: e.target.value })}
            >
              <option value="">{t("intake.selectSupplier")}</option>
              {activeSuppliers.map((s) => (
                <option key={s.code} value={s.code}>
                  {supplierDisplayName(s, locale)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="intake-mobile-only intake-context-panel">
        <IntakeMobileSetup
          intakeDate={intakeDate}
          setIntakeDate={(v) => requestNavigate({ kind: "date", value: v })}
          suppSel={suppSel}
          setSuppSel={(v) => requestNavigate({ kind: "supp", value: v })}
          suppliers={activeSuppliers}
        />
        {suppSel ? (
          <>
            <IntakeSlipStatusBar
              status={slipStatus}
              shopName={shopName}
              intakeDate={intakeDate}
              savedAt={lastAudit?.savedAt}
              savedByName={lastAudit?.savedByName}
              productCount={slipProductCount}
              hasDuplicateRows={hasDuplicateRows}
              role={role}
              suppCode={suppSel}
              reloading={reloadingSlip}
              onReload={() => void reloadLatest()}
              onReset={() => {
                if (!confirm(t("intake.resetConfirm"))) return;
                void loadExisting();
              }}
              onDeleted={() => {
                setRowVals({});
                setSlipNote("");
                setExistingTxns([]);
                setBaselineVals({});
                setBaselineSlipNote("");
                setSlipSnapshotAt("");
              }}
              showSavedActions={existingTxns.length > 0}
            />
          </>
        ) : null}
      </div>

      {!suppSel ? (
        <IntakeDayOverview
          intakeDate={intakeDate}
          suppliers={activeSuppliers}
          items={items}
          mapping={mapping}
          purchaseUnits={purchaseUnits}
          onSelectShop={(code) => requestNavigate({ kind: "supp", value: code })}
        />
      ) : (
        <>

          <p className="intake-hint intake-hint--desktop">{t("intake.hint")}</p>

          <div className="intake-mobile-only intake-cards-section">
            <IntakeItemCards
              items={filteredItems}
              search={search}
              setSearch={setSearch}
              rowVals={rowVals}
              setRow={setRow}
              calcUp={calcUp}
              onPurchaseUnitChange={setPurchaseUnitForItem}
              onOpenModal={() => setShowModal(true)}
            />
          </div>

          <div className="intake-desktop-only">
            <IntakeTable
              filteredItems={filteredItems}
              search={search}
              setSearch={setSearch}
              rowVals={rowVals}
              setRow={setRow}
              onPurchaseUnitChange={setPurchaseUnitForItem}
              onOpenModal={() => setShowModal(true)}
            />
          </div>

          <div className="intake-slip-note-section">
            <IntakeSlipNoteBar value={slipNote} onChange={setSlipNote} />
          </div>

          <IntakeStickyBar
            sumCount={sumCount}
            sumTotal={sumTotal}
            formFilled={formFilledCount}
            formTotal={filteredItems.length}
            saving={saving}
            shopName={shopName}
            onSave={requestSave}
          />

          <div className="sum-bar sum-bar--desktop">
            <div className="sum-item">
              <div style={{ fontSize: 10, opacity: 0.7 }}>{t("intake.rowsFilled")}</div>
              <div className="s-val">{sumCount}</div>
            </div>
            <div className="sum-sep" />
            <div className="sum-item">
              <div style={{ fontSize: 10, opacity: 0.7 }}>{t("intake.totalWon")}</div>
              <div className="s-val">₩{fmt(sumTotal)}</div>
            </div>
            <button
              type="button"
              className="btn btn-green"
              disabled={saving}
              onClick={requestSave}
              style={{ marginLeft: "auto" }}
            >
              {saving ? t("intake.saving") : t("intake.save")}
            </button>
          </div>
        </>
      )}

      <IntakeSaveConfirmModal
        open={showSaveConfirm}
        saving={saving}
        intakeDate={intakeDate}
        shopName={shopName}
        itemCount={sumCount}
        total={sumTotal}
        replacingExisting={existingTxns.length > 0}
        onClose={() => {
          if (!saving) setShowSaveConfirm(false);
        }}
        onConfirm={submit}
      />

      <IntakeUnsavedNavigateModal
        open={showUnsavedNav}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setShowUnsavedNav(false);
            setPendingNav(null);
          }
        }}
        onSave={() => {
          setShowUnsavedNav(false);
          requestSave();
        }}
        onDiscard={discardPendingNavigation}
      />

      <IntakeStaleSaveModal
        open={showStaleSave}
        saving={saving || reloadingSlip}
        serverSavedAt={staleMeta.maxSavedAt}
        serverSavedByName={staleMeta.savedByName}
        onClose={() => {
          if (!saving && !reloadingSlip) setShowStaleSave(false);
        }}
        onReload={() => {
          setShowStaleSave(false);
          void reloadLatest();
        }}
        onOverwrite={() => {
          setShowStaleSave(false);
          setShowSaveConfirm(true);
        }}
      />

      {showModal && (
        <div
          className="modal-overlay open"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">{t("intake.modalTitle")}</span>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)} aria-label={t("intake.cancel")}>
                <IconX size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <QaField label={t("intake.nameTh")} value={qa.nameTH} onChange={(v) => setQa({ ...qa, nameTH: v })} />
              </div>
              <div className="form-row c2">
                <QaField label={t("intake.nameEn")} value={qa.nameEN} onChange={(v) => setQa({ ...qa, nameEN: v })} />
                <QaField label={t("intake.nameKr")} value={qa.nameKR} onChange={(v) => setQa({ ...qa, nameKR: v })} />
              </div>
              {units.length === 0 ? (
                <p className="hint intake-qa-units-hint">{t("intake.toastNoUnits")}</p>
              ) : (
                <UnitSelectFields
                  mainUnits={qaMainUnits}
                  subUnits={qaSubUnits}
                  pairHints={qaPairHints}
                  aMain={qa.mainUnitCode}
                  setAMain={(code) => setQa({ ...qa, mainUnitCode: code })}
                  aSub={qa.subUnitCode}
                  setASub={(code) => setQa({ ...qa, subUnitCode: code })}
                  aConv={qa.conv}
                  setAConv={(v) => setQa({ ...qa, conv: v })}
                  labels={{
                    mainUnit: t("intake.mainUnit"),
                    subUnit: t("intake.subUnit"),
                    convert: t("intake.convert"),
                    select: t("intake.selectUnit"),
                  }}
                />
              )}
              <div className="form-row">
                <QaField label={t("intake.unitPriceWon")} value={qa.price} onChange={(v) => setQa({ ...qa, price: v })} type="number" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                {t("intake.cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={quickAdd}>
                {t("intake.saveNewProduct")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeTable({
  filteredItems,
  search,
  setSearch,
  rowVals,
  setRow,
  onPurchaseUnitChange,
  onOpenModal,
}: {
  filteredItems: CurItem[];
  search: string;
  setSearch: (s: string) => void;
  rowVals: IntakeRowVals;
  setRow: (rowKey: string, field: "qty" | "total", val: string) => void;
  onPurchaseUnitChange: (itemCode: string, mainUnitCode: string) => void;
  onOpenModal: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <div className="card">
      <div className="tbl-toolbar">
        <input
          type="text"
          placeholder={t("intake.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="meta">{t("intake.itemsCount", { n: filteredItems.length })}</span>
        <button type="button" className="btn btn-ghost" onClick={onOpenModal}>
          {t("intake.addProduct")}
        </button>
      </div>
      <div className="tbl-scroll">
        <table className="itbl itbl--intake">
          <thead>
            <tr>
              <th className="itbl__th-num">{t("intake.table.row")}</th>
              <th className="itbl__th-product">{t("intake.table.product")}</th>
              <th className="itbl__th-qty">{t("intake.qty")}</th>
              <th className="itbl__th-unit">{t("intake.table.unit")}</th>
              <th className="itbl__th-total">{t("intake.totalPrice")}</th>
              <th className="itbl__th-sub">{t("intake.table.subUnit")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((it, idx) => {
              const v = rowVals[it.rowKey] || { qty: "", total: "" };
              const filled = (parseFloat(v.qty) || 0) > 0 && (parseFloat(v.total) || 0) > 0;
              const primary = itemDisplayName(it, locale);
              const secondary = itemSecondaryName(it, locale);
              return (
                <tr
                  key={it.rowKey}
                  className={filled ? "filled" : ""}
                  style={{ display: search && !filteredItems.includes(it) ? "none" : undefined }}
                >
                  <td className="itbl__num">{idx + 1}</td>
                  <td className="itbl__product">
                    <div className="name-th">{primary}</div>
                    {secondary ? <div className="name-sub">{secondary}</div> : null}
                    <span className="itbl__code">{it.code}</span>
                  </td>
                  <td className="itbl__qty">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="inp-qty"
                      value={displayNumericField(v.qty)}
                      onChange={(e) => setRow(it.rowKey, "qty", e.target.value)}
                    />
                  </td>
                  <td className="itbl__unit">
                    {it.purchaseOptions.length > 1 ? (
                      <IntakePurchaseUnitSelect
                        options={it.purchaseOptions}
                        valueMainUnitCode={it.mainUnitCode}
                        onChange={(code) => onPurchaseUnitChange(it.code, code)}
                        className="itbl__purchase-unit"
                      />
                    ) : (
                      <span className="badge badge-blue">{it.unit}</span>
                    )}
                  </td>
                  <td className="itbl__total">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="inp-total"
                      value={displayNumericField(v.total)}
                      onChange={(e) => setRow(it.rowKey, "total", e.target.value)}
                    />
                    {it.refPrice > 0 ? (
                      <span className="intake-ref-price intake-ref-price--inline">
                        {t("intake.refPrice", { price: fmt(it.refPrice), unit: it.unit })}
                      </span>
                    ) : null}
                  </td>
                  <td className="itbl__sub">
                    <span className="badge badge-gray">{it.subUnit}</span>
                    <span className="itbl__convert">×{it.convertRate}</span>
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

function QaField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="lbl">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}