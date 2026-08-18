/** กรองให้เหลือตัวเลขและจุดทศนิยมเดียว (ใช้กับ type="text" + inputMode=decimal) */
export function sanitizeDecimalInput(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s;
}

/** โหลดจาก DB — ไม่แสดง 0 ในช่องว่าง */
export function loadedNumericField(n: number | string | null | undefined): string {
  const v = parseFloat(String(n ?? ""));
  if (!Number.isFinite(v) || v <= 0) return "";
  return String(v);
}

/** ไม่แสดงเลข 0 ลอยในช่อง (แต่ยังพิมพ์ 0.5 ได้) */
export function displayNumericField(s: string): string {
  if (s === "0") return "";
  if (!s) return "";

  const negative = s.startsWith("-");
  const raw = negative ? s.slice(1) : s;
  const hasTrailingDot = raw.endsWith(".");
  const [intPartRaw, fracPart] = raw.split(".", 2);
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || intPartRaw || "0";
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = negative ? "-" : "";

  if (hasTrailingDot) return `${prefix}${grouped}.`;
  if (fracPart !== undefined) return `${prefix}${grouped}.${fracPart}`;
  return `${prefix}${grouped}`;
}
