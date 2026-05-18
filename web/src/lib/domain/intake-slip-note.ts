/** ดึงหมายเหตุระดับใบจากแถวที่บันทึก (แถวในสินค้าเดียวกันมักมี note เดียวกัน) */
export function extractSlipNoteFromRows(rows: { note?: string }[]): string {
  const unique = [...new Set(rows.map((r) => (r.note || "").trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  return unique.join("; ");
}
