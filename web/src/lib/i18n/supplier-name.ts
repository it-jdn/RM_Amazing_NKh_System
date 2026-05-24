import type { Locale } from "./types";
import type { Supplier } from "@/lib/types";

export function supplierDisplayName(supplier: Supplier, locale: Locale): string {
  const th = supplier.nameTH?.trim() || "";
  const en = supplier.nameEN?.trim() || "";
  const kr = supplier.nameKR?.trim() || "";
  if (locale === "en") return en || th;
  if (locale === "kr") return kr || en || th;
  return th || en || kr;
}

/** Resolve localized shop label from catalog; falls back to snapshot name or code. */
export function supplierDisplayNameByCode(
  code: string,
  suppliers: readonly Supplier[],
  locale: Locale,
  fallback?: string
): string {
  const supp = suppliers.find((s) => s.code === code);
  if (supp) return supplierDisplayName(supp, locale);
  const fb = fallback?.trim();
  return fb || code;
}
