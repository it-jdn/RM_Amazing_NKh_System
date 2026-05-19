export type AppRole = "operator" | "admin" | "manager";

export interface SessionPayload {
  userId: string;
  displayName: string;
  role: AppRole;
}

export interface Supplier {
  code: string;
  nameTH: string;
  nameEN: string;
  nameKR: string;
  active?: boolean;
  /** Display order in intake shop picker (lower first). */
  sortOrder?: number;
}

export type ItemCategoryCode = "PROT" | "PROD" | "SEA" | "PANTRY" | "BEV";

export interface ItemCategory {
  code: ItemCategoryCode;
  nameTH: string;
  nameEN: string;
  nameKR: string;
  sortOrder: number;
}

export interface Item {
  code: string;
  nameTH: string;
  nameEN: string;
  nameKR: string;
  unit: string;
  subUnit: string;
  convertRate: number;
  mainUnitCode?: string;
  subUnitCode?: string;
  categoryCode: ItemCategoryCode;
}

export interface UnitOption {
  unitCode: string;
  nameTH: string;
  nameEN: string;
  nameKR: string;
  usageCountMain: number;
  usageCountSub: number;
}

export interface UnitPairHint {
  mainUnitCode: string;
  subUnitCode: string;
  convertRate: number;
  useCount: number;
  mainDisplayName?: string;
  subDisplayName?: string;
}

export interface Mapping {
  suppCode: string;
  itemCode: string;
  /** Standard list price (₩) */
  unitPrice: number;
  standardUnitPrice: number;
  lastPurchaseUnitPrice?: number;
  mainUnitCode?: string;
  subUnitCode?: string;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
}

/** หน่วยซื้อเข้ามาตรฐานระดับสินค้า (ตั้งในเมนูสินค้า) */
export interface ItemStandardPurchaseUnit {
  itemCode: string;
  mainUnitCode: string;
  subUnitCode: string;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  isDefault: boolean;
  sortOrder: number;
  active?: boolean;
}

/** หน่วยซื้อเข้าที่เปิดใช้ต่อร้าน+สินค้า (อ้างอิงมาตรฐาน + ราคาร้าน) */
export interface ItemPurchaseUnit {
  suppCode: string;
  itemCode: string;
  mainUnitCode: string;
  subUnitCode: string;
  mainUnit: string;
  subUnit: string;
  convertRate: number;
  standardUnitPrice: number;
  isDefault: boolean;
  sortOrder: number;
  active?: boolean;
}

export interface TransactionInput {
  date: string;
  suppCode: string;
  suppName: string;
  itemCode: string;
  itemNameTH: string;
  qty: number;
  mainUnit: string;
  convertRate: number;
  subUnit: string;
  unitPrice?: number;
  totalPrice: number;
  note?: string;
  standardUnitPriceAtSave?: number;
}

export interface TransactionRow {
  no?: number;
  slipId?: string;
  date: string;
  suppCode: string;
  suppName: string;
  itemCode: string;
  itemNameTH: string;
  qty: number;
  mainUnit: string;
  unitPrice: number;
  totalPrice: number;
  note: string;
  savedAt?: string;
  savedByName?: string;
}

/** สรุปใบรับของหนึ่งใบ (หลายใบต่อร้านต่อวันได้) */
export interface IntakeSlipSummary {
  id: string;
  date: string;
  suppCode: string;
  suppName: string;
  slipNote: string;
  createdAt: string;
  createdByUserId: string | null;
  createdByName: string;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByName: string;
  lineCount: number;
  productCount: number;
  totalPrice: number;
}

export interface SaveAudit {
  userId: string;
  displayName: string;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  suppCode?: string;
  itemCode?: string;
  categoryCode?: string;
  page?: number;
  pageSize?: number;
}
