import type { Locale } from "./types";

export type NamedItem = {
  nameTH: string;
  nameEN?: string;
  nameKR?: string;
};

/** Legacy CSV / txn snapshots: "ชื่อไทย / English / 한국어" */
export function parseLegacyCombinedItemName(raw: string): NamedItem {
  const trimmed = raw.trim();
  if (!trimmed.includes(" / ")) {
    return { nameTH: trimmed, nameEN: "", nameKR: "" };
  }
  const parts = trimmed.split(" / ").map((p) => p.trim());
  return {
    nameTH: parts[0] || trimmed,
    nameEN: parts[1] || "",
    nameKR: parts[2] || "",
  };
}

function normalizeNamedItem(item: NamedItem): NamedItem {
  const th = item.nameTH?.trim() || "";
  const en = item.nameEN?.trim() || "";
  const kr = item.nameKR?.trim() || "";
  if (th.includes(" / ") && !en && !kr) {
    return parseLegacyCombinedItemName(th);
  }
  return item;
}

export function hasAnyItemName(item: NamedItem): boolean {
  const n = normalizeNamedItem(item);
  return Boolean(n.nameTH?.trim() || n.nameEN?.trim() || n.nameKR?.trim());
}

/**
 * DB column item_name_th is NOT NULL — when only EN/KR is filled, store primary there too.
 */
export function normalizeItemNamesForSave(
  input: NamedItem
): { nameTH: string; nameEN: string; nameKR: string; primary: string } | null {
  const n = normalizeNamedItem(input);
  const th = n.nameTH?.trim() || "";
  const en = n.nameEN?.trim() || "";
  const kr = n.nameKR?.trim() || "";
  const primary = th || en || kr;
  if (!primary) return null;
  return {
    nameTH: th || primary,
    nameEN: en,
    nameKR: kr,
    primary,
  };
}

export function itemNamesOverlapForDuplicate(a: NamedItem, b: NamedItem): boolean {
  const keys = (item: NamedItem) => {
    const x = normalizeNamedItem(item);
    return [x.nameTH, x.nameEN, x.nameKR]
      .map((s) => (s ?? "").trim().toLowerCase())
      .filter(Boolean);
  };
  const left = keys(a);
  const right = keys(b);
  return left.some((k) => right.includes(k));
}

export function itemDisplayName(item: NamedItem, locale: Locale): string {
  const n = normalizeNamedItem(item);
  const th = n.nameTH?.trim() || "";
  const en = n.nameEN?.trim() || "";
  const kr = n.nameKR?.trim() || "";
  if (locale === "en") return en || th || kr;
  if (locale === "kr") return kr || en || th;
  return th || en || kr;
}

/** Sort catalog items by display name for dropdowns (locale-aware). */
export function sortItemsByDisplayName<T extends NamedItem & { code: string }>(
  list: readonly T[],
  locale: Locale
): T[] {
  return [...list].sort((a, b) =>
    itemDisplayName(a, locale).localeCompare(itemDisplayName(b, locale), locale, {
      sensitivity: "base",
      numeric: true,
    })
  );
}

export function itemDisplayNameByCode<T extends NamedItem & { code: string }>(
  code: string,
  items: readonly T[],
  locale: Locale,
  fallback?: string
): string {
  const item = items.find((i) => i.code === code);
  if (item) return itemDisplayName(item, locale);
  const fb = fallback?.trim();
  if (fb) return itemDisplayName(parseLegacyCombinedItemName(fb), locale);
  return code;
}

/** Catalog item, or parsed txn snapshot when code is unknown. */
export function itemLabel(
  item: NamedItem | null | undefined,
  locale: Locale,
  snapshot?: string
): string {
  if (item) return itemDisplayName(item, locale);
  const fb = snapshot?.trim();
  if (!fb) return "—";
  return itemDisplayName(parseLegacyCombinedItemName(fb), locale);
}

/** ชื่อรอง (ภาษาอื่น) สำหรับแสดงใต้ชื่อหลักบนการ์ด — เฉพาะโหมดภาษาไทย */
export function itemSecondaryName(item: NamedItem, locale: Locale): string | null {
  if (locale === "en" || locale === "kr") return null;
  const n = normalizeNamedItem(item);
  const primary = itemDisplayName(n, locale);
  const parts: string[] = [];
  if (n.nameEN?.trim() && n.nameEN.trim() !== primary) {
    parts.push(n.nameEN.trim());
  }
  if (n.nameKR?.trim() && n.nameKR.trim() !== primary) {
    parts.push(n.nameKR.trim());
  }
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(" · ") : null;
}
