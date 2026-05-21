"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/AppDataContext";
import { apiGet, apiPost } from "@/lib/api/client";
import { IntakeSaveConfirmModal } from "@/components/intake/IntakeSaveConfirmModal";
import { IntakePurchaseUnitSelect } from "@/components/intake/IntakePurchaseUnitSelect";
import { IntakeItemCards } from "@/components/operator/IntakeItemCards";
import { IntakeMobileSetup } from "@/components/operator/IntakeMobileSetup";
import { IconChevronDown, IconChevronUp, IconX } from "@/components/icons/AppIcons";
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
import {
  DEFAULT_INTAKE_ITEM_SORT,
  sortIntakeItems,
  type IntakeItemSortColumn,
  type IntakeItemSortState,
} from "@/lib/domain/intake-item-sort";
import { extractSlipNoteFromRows } from "@/lib/domain/intake-slip-note";
import { IntakeBackToOverviewBar } from "@/components/intake/IntakeBackToOverviewBar";
import { IntakeDayOverview } from "@/components/intake/IntakeDayOverview";
import { IntakeShopSlips } from "@/components/intake/IntakeShopSlips";
import { IntakeLoadPanel } from "@/components/intake/IntakeLoadPanel";
import { IntakeSlipStatusBar, type IntakeSlipStatus } from "@/components/intake/IntakeSlipStatusBar";
import { IntakeStaleSaveModal } from "@/components/intake/IntakeStaleSaveModal";
import { IntakeResetFormModal } from "@/components/intake/IntakeResetFormModal";
import { IntakeUnsavedNavigateModal } from "@/components/intake/IntakeUnsavedNavigateModal";
import { UnitSelectFields } from "@/components/pages/admin/UnitSelectFields";
import { AppDateField } from "@/components/ui/AppDateField";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { UnitPairHint } from "@/lib/types";
import { useModalLayer } from "@/hooks/useModalLayer";
import { useIntakeNavGuardOptional } from "@/context/IntakeNavGuardContext";
import { fmt, todayISO } from "@/lib/utils/format";
import {
  displayNumericField,
  loadedNumericField,
  sanitizeDecimalInput,
} from "@/lib/utils/numeric-input";
import type { IntakeSlipSummary, Item, ItemPurchaseUnit, TransactionInput, TransactionRow } from "@/lib/types";

type CurItem = Item & {
  refPrice: number;
  rowKey: string;
  mainUnitCode: string;
  purchaseOptions: ItemPurchaseUnit[];
};

type PendingNav =
  | { kind: "date"; value: string }
  | { kind: "supp"; value: string }
  | { kind: "slip"; slipId: string; suppCode: string; slipNo?: number };

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
  const [activeSlipId, setActiveSlipId] = useState("");
  const [activeSlipNo, setActiveSlipNo] = useState<number | null>(null);
  const [canEditSlip, setCanEditSlip] = useState(true);
  const [activeSlipMeta, setActiveSlipMeta] = useState<IntakeSlipSummary | null>(null);
  const [slipListRefresh, setSlipListRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [intakeSort, setIntakeSort] = useState<IntakeItemSortState>(DEFAULT_INTAKE_ITEM_SORT);
  const [rowVals, setRowVals] = useState<IntakeRowVals>({});
  const [selectedPurchaseUnit, setSelectedPurchaseUnit] = useState<Record<string, string>>({});
  /** Loaded slip-level note (UI hidden for now; preserved on save). */
  const [loadedSlipNote, setLoadedSlipNote] = useState("");
  const [existingTxns, setExistingTxns] = useState<TransactionRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUnsavedNav, setShowUnsavedNav] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const [baselineVals, setBaselineVals] = useState<IntakeRowVals>({});
  const [slipSnapshotAt, setSlipSnapshotAt] = useState("");
  const [showStaleSave, setShowStaleSave] = useState(false);
  const [staleMeta, setStaleMeta] = useState({ maxSavedAt: "", savedByName: "" });
  const [reloadingSlip, setReloadingSlip] = useState(false);
  const [loadingSlip, setLoadingSlip] = useState(false);
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

  const resetNewSlipForm = useCallback(() => {
    setRowVals({});
    setSelectedPurchaseUnit({});
    setLoadedSlipNote("");
    setExistingTxns([]);
    setBaselineVals({});
    setSlipSnapshotAt("");
    setCanEditSlip(true);
    setActiveSlipMeta(null);
  }, []);

  const applyRowsToForm = useCallback(
    (rows: TransactionRow[], slipNoteFromSlip?: string) => {
      setExistingTxns(rows);
      const aggregated = aggregateTransactionsByItem(rows);
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
      const loadedNote =
        slipNoteFromSlip?.trim() || extractSlipNoteFromRows(rows);
      setRowVals(vals);
      setBaselineVals(cloneIntakeRowVals(vals));
      setLoadedSlipNote(loadedNote);
      setSlipSnapshotAt(maxSavedAtFromRows(rows));
    },
    [suppSel, mapping, purchaseUnits, itemPurchaseStandards]
  );

  const loadSlipById = useCallback(
    async (slipId: string) => {
      if (!slipId || !suppSel) return;
      setLoadingSlip(true);
      try {
        const d = await apiGet<{
          success: boolean;
          slip: IntakeSlipSummary;
          rows: TransactionRow[];
          canEdit: boolean;
        }>(`/api/transactions/slips/${encodeURIComponent(slipId)}`);
        if (!d.success || !d.slip) return;
        setCanEditSlip(d.canEdit);
        setActiveSlipMeta(d.slip);
        applyRowsToForm(d.rows, d.slip.slipNote);
        setSlipSnapshotAt(d.slip.updatedAt);
      } catch {
        /* ignore */
      } finally {
        setLoadingSlip(false);
      }
    },
    [suppSel, applyRowsToForm]
  );

  useEffect(() => {
    if (!suppSel) {
      setActiveSlipId("");
      setActiveSlipNo(null);
      resetNewSlipForm();
      return;
    }
    if (activeSlipId) {
      void loadSlipById(activeSlipId);
    } else {
      resetNewSlipForm();
    }
  }, [suppSel, intakeDate, activeSlipId, loadSlipById, resetNewSlipForm]);

  const isDirty = useMemo(() => {
    if (!suppSel) return false;
    return isIntakeRowValsDirty(rowVals, baselineVals);
  }, [suppSel, rowVals, baselineVals]);

  const setIntakeNavDirty = useIntakeNavGuardOptional()?.setIntakeDirty;
  useEffect(() => {
    if (!setIntakeNavDirty) return;
    setIntakeNavDirty(isDirty);
    return () => setIntakeNavDirty(false);
  }, [isDirty, setIntakeNavDirty]);

  function applyNavigation(nav: PendingNav) {
    if (nav.kind === "date") {
      setIntakeDate(nav.value);
      setSuppSel("");
      setActiveSlipId("");
      setActiveSlipNo(null);
    } else if (nav.kind === "supp") {
      setSuppSel(nav.value);
      setActiveSlipId("");
      setActiveSlipNo(null);
    } else {
      setSuppSel(nav.suppCode);
      setActiveSlipId(nav.slipId);
      setActiveSlipNo(nav.slipNo ?? null);
    }
  }

  function requestNavigate(nav: PendingNav) {
    if (nav.kind === "date" && nav.value === intakeDate) return;
    if (nav.kind === "supp" && nav.value === suppSel) return;
    if (nav.kind === "slip" && nav.suppCode === suppSel && nav.slipId === activeSlipId) return;
    if (!suppSel || !isDirty) {
      applyNavigation(nav);
      return;
    }
    setPendingNav(nav);
    setShowUnsavedNav(true);
  }

  function openSlip(slipId: string, suppCode: string, slipNo?: number) {
    requestNavigate({ kind: "slip", slipId, suppCode, slipNo });
  }

  function selectShop(suppCode: string) {
    requestNavigate({ kind: "supp", value: suppCode });
  }

  function goBackToOverview() {
    requestNavigate({ kind: "supp", value: "" });
  }

  function startNewSlip() {
    if (activeSlipId === "") return;
    if (isDirty && !confirm(t("intake.unsavedNewSlipConfirm"))) return;
    setActiveSlipId("");
    setActiveSlipNo(null);
  }

  function selectSlip(slipId: string, slipNo: number) {
    if (slipId === activeSlipId) return;
    if (isDirty && !confirm(t("intake.unsavedNewSlipConfirm"))) return;
    setActiveSlipId(slipId);
    setActiveSlipNo(slipNo);
  }

  function discardPendingNavigation() {
    const nav = pendingNav;
    setPendingNav(null);
    setShowUnsavedNav(false);
    if (!nav) return;
    applyNavigation(nav);
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

  const displaySortedItems = useMemo(
    () => sortIntakeItems(filteredItems, intakeSort, locale, rowVals),
    [filteredItems, intakeSort, locale, rowVals]
  );

  const toggleIntakeSort = useCallback((column: IntakeItemSortColumn) => {
    setIntakeSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" }
    );
  }, []);

  useEffect(() => {
    setIntakeSort(DEFAULT_INTAKE_ITEM_SORT);
  }, [suppSel, activeSlipId]);

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

  const slipAudit = useMemo(() => {
    if (activeSlipMeta) {
      return {
        createdAt: activeSlipMeta.createdAt,
        createdByName: activeSlipMeta.createdByName,
        updatedAt: activeSlipMeta.updatedAt,
        updatedByName: activeSlipMeta.updatedByName,
      };
    }
    return null;
  }, [activeSlipMeta]);

  const readOnly = Boolean(activeSlipId && !canEditSlip);

  const slipStatus = useMemo((): IntakeSlipStatus => {
    if (existingTxns.length > 0) return isDirty ? "modified" : "saved";
    if (hasIntakeRowInput(rowVals)) return "draft";
    return "new";
  }, [existingTxns.length, isDirty, rowVals]);

  const hasDuplicateRows = existingTxns.length > existingProductCount;
  const slipProductCount = existingTxns.length > 0 ? existingProductCount : sumCount;

  async function fetchSlipMeta() {
    if (activeSlipId) {
      return apiGet<SlipMetaResponse>(
        `/api/transactions/slip-meta?slipId=${encodeURIComponent(activeSlipId)}`
      );
    }
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
      if (activeSlipId) await loadSlipById(activeSlipId);
      else resetNewSlipForm();
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
        note: loadedSlipNote.trim(),
      });
    }
    return txns;
  }

  function requestSave() {
    if (readOnly) {
      toast(t("intake.readOnlyHint"));
      return;
    }
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
      const r = await apiPost<{ success: boolean; message: string; replaced?: boolean; slipId?: string }>(
        "/api/transactions",
        {
          transactions: txns,
          slipId: activeSlipId || undefined,
          slipNote: loadedSlipNote.trim(),
        }
      );
      toast(`✅ ${r.replaced ? t("intake.toastUpdated") : r.message || t("intake.toastSaved")}`);
      setShowSaveConfirm(false);
      setShowStaleSave(false);
      const nav = pendingNav;
      setPendingNav(null);
      setShowUnsavedNav(false);
      if (nav) {
        applyNavigation(nav);
      } else {
        applyNavigation({ kind: "supp", value: "" });
      }
      setSlipListRefresh((k) => k + 1);
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

  const slipStatusLabel =
    saving
      ? t("intake.slipStatus.saving")
      : loadingSlip
        ? t("intake.slipStatus.loading")
        : slipStatus === "saved"
          ? t("intake.slipStatus.saved")
          : slipStatus === "modified"
            ? t("intake.slipStatus.modified")
            : slipStatus === "draft"
              ? t("intake.slipStatus.draft")
              : t("intake.slipStatus.new");

  const slipStatusChipClass = saving
    ? "saving"
    : loadingSlip
      ? "loading"
      : slipStatus;

  function renderSlipStatusBar() {
    if (!suppSel) return null;
    return (
      <IntakeSlipStatusBar
        status={slipStatus}
        shopName={shopName}
        intakeDate={intakeDate}
        slipId={activeSlipId}
        createdAt={slipAudit?.createdAt}
        createdByName={slipAudit?.createdByName}
        updatedAt={slipAudit?.updatedAt}
        updatedByName={slipAudit?.updatedByName}
        productCount={slipProductCount}
        hasDuplicateRows={hasDuplicateRows}
        role={role}
        suppCode={suppSel}
        canEdit={canEditSlip}
        readOnly={readOnly}
        loading={loadingSlip}
        saving={saving}
        onReset={() => setShowResetConfirm(true)}
        slipNo={activeSlipNo ?? undefined}
        slipTotal={
          !activeSlipId || isDirty || slipStatus === "draft" || slipStatus === "new"
            ? sumTotal
            : activeSlipMeta?.totalPrice
        }
        onDeleted={() => {
          setActiveSlipId("");
          setActiveSlipNo(null);
          setSlipListRefresh((k) => k + 1);
          resetNewSlipForm();
        }}
        showSavedActions={Boolean(activeSlipId && canEditSlip)}
      />
    );
  }

  return (
    <div className={wrapClass}>
      <div className="card intake-setup-card intake-desktop-only">
        <div className="intake-setup-card__head">
          <div className="card-title">
            <span className="dot dot-green" />
            <span>{t("intake.title")}</span>
          </div>
          <p className="intake-setup-card__description">{t("intake.description")}</p>
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
          <div className="intake-supplier-field">
            <label className="lbl">{t("intake.supplier")}</label>
            <select
              className={!suppSel ? "intake-supplier-select intake-supplier-select--prompt" : "intake-supplier-select"}
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
      </div>

      {!suppSel ? (
        <>
          <IntakeDayOverview
          key={slipListRefresh}
          intakeDate={intakeDate}
          suppliers={activeSuppliers}
          items={items}
          mapping={mapping}
          purchaseUnits={purchaseUnits}
          onSelectSlip={openSlip}
          onSelectShop={selectShop}
        />
        </>
      ) : (
        <>
          <IntakeBackToOverviewBar
            label={t("intake.backToOverview")}
            onBack={goBackToOverview}
          />
          <div className="intake-document">
          <IntakeShopSlips
            key={slipListRefresh}
            intakeDate={intakeDate}
            suppCode={suppSel}
            activeSlipId={activeSlipId}
            onSelectSlip={selectSlip}
            onNewSlip={startNewSlip}
          />

          <div className="intake-document__sheet">
            {renderSlipStatusBar()}

            {readOnly ? (
              <p className="intake-document__readonly" role="status">
                {t("intake.readOnlyBanner")}
              </p>
            ) : null}

            <div
              className={`intake-form-body intake-document__body${loadingSlip ? " intake-form-body--loading" : ""}`}
              aria-busy={loadingSlip || saving || undefined}
            >
            {loadingSlip ? (
              <div className="intake-form-load-overlay">
                <IntakeLoadPanel message={t("intake.slipStatus.loadingDetail")} />
              </div>
            ) : null}

          <div className="intake-mobile-only intake-cards-section">
            <IntakeItemCards
              items={displaySortedItems}
              search={search}
              setSearch={setSearch}
              rowVals={rowVals}
              setRow={setRow}
              calcUp={calcUp}
              onPurchaseUnitChange={setPurchaseUnitForItem}
              onOpenModal={() => setShowModal(true)}
              readOnly={readOnly}
            />
          </div>

          <div className="intake-desktop-only">
            <IntakeTable
              items={displaySortedItems}
              sort={intakeSort}
              onSortColumn={toggleIntakeSort}
              search={search}
              setSearch={setSearch}
              rowVals={rowVals}
              setRow={setRow}
              onPurchaseUnitChange={setPurchaseUnitForItem}
              onOpenModal={() => setShowModal(true)}
              readOnly={readOnly}
            />
          </div>

            <p className="intake-document__footnote">{t("intake.hint")}</p>
            </div>
          </div>

          <IntakeStickyBar
            sumCount={sumCount}
            sumTotal={sumTotal}
            formFilled={formFilledCount}
            formTotal={filteredItems.length}
            saving={saving || loadingSlip || readOnly}
            shopName={shopName}
            onSave={requestSave}
          />

          <div className="sum-bar sum-bar--desktop">
            <div
              className={`intake-slip-status-chip intake-slip-status-chip--${slipStatusChipClass}`}
              role="status"
            >
              <span className="intake-slip-status-chip__dot" aria-hidden />
              <span>{slipStatusLabel}</span>
            </div>
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
              disabled={saving || loadingSlip || readOnly}
              onClick={requestSave}
              style={{ marginLeft: "auto" }}
            >
              {saving ? t("intake.saving") : loadingSlip ? t("intake.slipStatus.loading") : t("intake.save")}
            </button>
          </div>
        </div>
        </>
      )}

      <IntakeResetFormModal
        open={showResetConfirm}
        busy={loadingSlip}
        onClose={() => {
          if (!loadingSlip) setShowResetConfirm(false);
        }}
        onConfirm={() => {
          setShowResetConfirm(false);
          if (activeSlipId) void loadSlipById(activeSlipId);
          else resetNewSlipForm();
        }}
      />

      <IntakeSaveConfirmModal
        open={showSaveConfirm}
        saving={saving}
        intakeDate={intakeDate}
        shopName={shopName}
        itemCount={sumCount}
        total={sumTotal}
        replacingExisting={Boolean(activeSlipId)}
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
  items,
  sort,
  onSortColumn,
  search,
  setSearch,
  rowVals,
  setRow,
  onPurchaseUnitChange,
  onOpenModal,
  readOnly = false,
}: {
  items: CurItem[];
  sort: IntakeItemSortState;
  onSortColumn: (column: IntakeItemSortColumn) => void;
  search: string;
  setSearch: (s: string) => void;
  rowVals: IntakeRowVals;
  setRow: (rowKey: string, field: "qty" | "total", val: string) => void;
  onPurchaseUnitChange: (itemCode: string, mainUnitCode: string) => void;
  onOpenModal: () => void;
  readOnly?: boolean;
}) {
  const { locale, t } = useLocale();

  function SortTh({
    column,
    label,
    className,
  }: {
    column: IntakeItemSortColumn;
    label: string;
    className: string;
  }) {
    const active = sort.column === column;
    const orderLabel = sort.direction === "asc" ? t("intake.sort.asc") : t("intake.sort.desc");
    const ariaLabel = active
      ? t("intake.table.sortState", { column: label, order: orderLabel })
      : t("intake.table.sortHint", { column: label });
    return (
      <th
        className={`itbl__th-sort ${className}`.trim()}
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

  return (
    <div className="card">
      <div className="tbl-toolbar">
        <input
          type="text"
          placeholder={t("intake.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="meta">{t("intake.itemsCount", { n: items.length })}</span>
        <button type="button" className="btn btn-ghost" onClick={onOpenModal} disabled={readOnly}>
          {t("intake.addProduct")}
        </button>
      </div>
      <div className="tbl-scroll">
        <table className="itbl itbl--intake">
          <thead>
            <tr>
              <th className="itbl__th-num" scope="col">
                {t("intake.table.row")}
              </th>
              <SortTh column="code" label={t("intake.table.code")} className="itbl__th-code" />
              <SortTh column="name" label={t("intake.table.product")} className="itbl__th-product" />
              <SortTh column="qty" label={t("intake.qty")} className="itbl__th-qty itbl__th-sort--end" />
              <SortTh column="unit" label={t("intake.table.unit")} className="itbl__th-unit" />
              <SortTh
                column="total"
                label={t("intake.totalPrice")}
                className="itbl__th-total itbl__th-sort--end"
              />
              <SortTh column="sub" label={t("intake.table.subUnit")} className="itbl__th-sub" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const v = rowVals[it.rowKey] || { qty: "", total: "" };
              const filled = (parseFloat(v.qty) || 0) > 0 && (parseFloat(v.total) || 0) > 0;
              const primary = itemDisplayName(it, locale);
              const secondary = itemSecondaryName(it, locale);
              return (
                <tr key={it.rowKey} className={filled ? "filled" : ""}>
                  <td className="itbl__num">{idx + 1}</td>
                  <td className="itbl__code-cell">
                    <span className="itbl__code-mono">{it.code}</span>
                  </td>
                  <td className="itbl__product">
                    <div className="name-th">{primary}</div>
                    {secondary ? <div className="name-sub">{secondary}</div> : null}
                  </td>
                  <td className="itbl__qty">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="inp-qty"
                      value={displayNumericField(v.qty)}
                      onChange={(e) => setRow(it.rowKey, "qty", e.target.value)}
                      disabled={readOnly}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="itbl__unit">
                    {it.purchaseOptions.length > 1 ? (
                      <IntakePurchaseUnitSelect
                        options={it.purchaseOptions}
                        valueMainUnitCode={it.mainUnitCode}
                        onChange={(code) => onPurchaseUnitChange(it.code, code)}
                        className="itbl__purchase-unit"
                        disabled={readOnly}
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
                      disabled={readOnly}
                      readOnly={readOnly}
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