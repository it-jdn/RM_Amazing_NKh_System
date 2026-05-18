/** คีย์แถวรับสินค้า = รหัสสินค้า + หน่วยซื้อเข้า (ชื่อหน่วยที่บันทึกใน transactions) */
export function intakeRowKey(itemCode: string, mainUnit: string) {
  return `${itemCode}::${mainUnit.trim()}`;
}

export function parseIntakeRowKey(key: string): { itemCode: string; mainUnit: string } | null {
  const i = key.indexOf("::");
  if (i <= 0) return null;
  return {
    itemCode: key.slice(0, i),
    mainUnit: key.slice(i + 2),
  };
}
