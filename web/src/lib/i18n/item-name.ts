import type { Locale } from "./types";

type NamedItem = {
  nameTH: string;
  nameEN?: string;
  nameKR?: string;
};

export function itemDisplayName(item: NamedItem, locale: Locale): string {
  const th = item.nameTH?.trim() || "";
  const en = item.nameEN?.trim() || "";
  const kr = item.nameKR?.trim() || "";
  if (locale === "en") return en || th;
  if (locale === "kr") return kr || en || th;
  return th || en || kr;
}

/** ชื่อรอง (ภาษาอื่น) สำหรับแสดงใต้ชื่อหลักบนการ์ด */
export function itemSecondaryName(item: NamedItem, locale: Locale): string | null {
  const primary = itemDisplayName(item, locale);
  const parts: string[] = [];
  if (locale !== "th" && item.nameTH?.trim() && item.nameTH.trim() !== primary) {
    parts.push(item.nameTH.trim());
  }
  if (locale !== "en" && item.nameEN?.trim() && item.nameEN.trim() !== primary) {
    parts.push(item.nameEN.trim());
  }
  if (locale !== "kr" && item.nameKR?.trim() && item.nameKR.trim() !== primary) {
    parts.push(item.nameKR.trim());
  }
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : null;
}
