"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiGet } from "@/lib/api/client";
import type {
  AppRole,
  Item,
  ItemCategory,
  ItemPurchaseUnit,
  ItemStandardPurchaseUnit,
  Mapping,
  Supplier,
  UnitOption,
} from "@/lib/types";
import { useToast } from "@/components/Toast";

interface InitialData {
  success: boolean;
  suppliers: Supplier[];
  items: Item[];
  mapping: Mapping[];
  purchaseUnits: ItemPurchaseUnit[];
  itemPurchaseStandards: ItemStandardPurchaseUnit[];
  units: UnitOption[];
  itemCategories?: ItemCategory[];
}

interface AppDataContextValue {
  role: AppRole;
  suppliers: Supplier[];
  items: Item[];
  mapping: Mapping[];
  purchaseUnits: ItemPurchaseUnit[];
  /** หน่วยซื้อเข้ามาตรฐานระดับสินค้า */
  itemPurchaseStandards: ItemStandardPurchaseUnit[];
  /** หน่วยสินค้าจากตาราง units — โหลดครั้งเดียวกับข้อมูลหลัก */
  units: UnitOption[];
  itemCategories: ItemCategory[];
  loading: boolean;
  reload: () => Promise<void>;
}

const INITIAL_LOAD_ATTEMPTS = 3;
const INITIAL_LOAD_RETRY_MS = 700;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchInitialData(): Promise<InitialData> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= INITIAL_LOAD_ATTEMPTS; attempt++) {
    try {
      return await apiGet<InitialData>("/api/data/initial");
    } catch (e) {
      lastError = e;
      if (attempt < INITIAL_LOAD_ATTEMPTS) {
        await wait(INITIAL_LOAD_RETRY_MS * attempt);
      }
    }
  }
  throw lastError;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({
  children,
  role,
}: {
  children: ReactNode;
  role: AppRole;
}) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [mapping, setMapping] = useState<Mapping[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<ItemPurchaseUnit[]>([]);
  const [itemPurchaseStandards, setItemPurchaseStandards] = useState<ItemStandardPurchaseUnit[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const loadSeqRef = useRef(0);

  const reload = useCallback(async () => {
    const loadId = ++loadSeqRef.current;
    setLoading(true);
    try {
      const d = await fetchInitialData();
      if (loadId !== loadSeqRef.current) return;
      if (!d.success) {
        toast("โหลดข้อมูลผิดพลาด");
        return;
      }
      setSuppliers(d.suppliers);
      setItems(d.items);
      setMapping(d.mapping);
      setPurchaseUnits(d.purchaseUnits || []);
      setItemPurchaseStandards(d.itemPurchaseStandards || []);
      setUnits(d.units || []);
      setItemCategories(d.itemCategories || []);
    } catch (e) {
      if (loadId !== loadSeqRef.current) return;
      const detail = e instanceof Error ? e.message : String(e);
      toast(`โหลดข้อมูลไม่สำเร็จ: ${detail}`);
    } finally {
      if (loadId === loadSeqRef.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <AppDataContext.Provider
      value={{
        role,
        suppliers,
        items,
        mapping,
        purchaseUnits,
        itemPurchaseStandards,
        units,
        itemCategories,
        loading,
        reload,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be inside AppDataProvider");
  return ctx;
}
