/** Normalize unit label for deduplication (transactions + items). */
export function normalizeUnitKey(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function unitCodeFromKey(normalizedKey: string, taken: Set<string>): string {
  let base = normalizedKey
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 14)
    .toUpperCase();
  if (!base) base = "UNIT";
  let code = base;
  let n = 1;
  while (taken.has(code)) {
    code = `${base}${n}`;
    n += 1;
  }
  taken.add(code);
  return code;
}

export type UnitKind = "main" | "sub" | "all";

export interface UnitRow {
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
