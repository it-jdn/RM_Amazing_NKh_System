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
