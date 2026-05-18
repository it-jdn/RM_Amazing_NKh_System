import type { Supplier } from "@/lib/types";

export function compareSupplierCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortSuppliersByCode(suppliers: Supplier[]) {
  return [...suppliers].sort((a, b) => compareSupplierCodes(a.code, b.code));
}

/** Order used in intake / report shop pickers (admin-configurable). */
export function sortSuppliersForPicker(suppliers: Supplier[]) {
  return [...suppliers].sort((a, b) => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return compareSupplierCodes(a.code, b.code);
  });
}
