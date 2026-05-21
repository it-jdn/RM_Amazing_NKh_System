/** ข้อความจาก response body ของ API */
export function messageFromApiBody(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  return null;
}

/** PostgREST: คอลัมน์/ตารางยังไม่อยู่ใน schema cache */
export function isMissingColumnError(err: { code?: string; message?: string }, column?: string) {
  const code = String(err.code || "");
  const msg = String(err.message || "");
  if (code === "PGRST204") {
    if (!column) return true;
    return msg.includes(`'${column}'`);
  }
  if (msg.includes("schema cache") && msg.includes("column")) {
    if (!column) return true;
    return msg.includes(`'${column}'`);
  }
  return false;
}

/** แปลงข้อความ error จาก Postgres/Supabase เป็นภาษาไทยที่อ่านง่าย */
export function formatPostgresError(e: unknown, fallback = "❌ เกิดข้อผิดพลาด"): string {
  const msg =
    e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
      ? String((e as { message: string }).message)
      : e instanceof Error
        ? e.message
        : "";

  if (!msg) return fallback;
  if (
    msg.includes("category_code") &&
    (msg.includes("schema cache") || msg.includes("PGRST204"))
  ) {
    return "❌ ยังไม่มีคอลัมน์หมวดหมู่สินค้า — รัน migration 010_item_categories.sql บน Supabase SQL Editor";
  }
  if (msg.includes("item_purchase_units") && (msg.includes("does not exist") || msg.includes("42P01"))) {
    return "❌ ยังไม่มีตารางหน่วยมาตรฐาน — รัน migration 012_item_purchase_units.sql บน Supabase";
  }
  if (msg.includes("duplicate key") || msg.includes("23505")) {
    return "❌ หน่วยซื้อเข้าหลักซ้ำกัน — แต่ละแถวต้องใช้หน่วยหลักคนละตัว";
  }
  if (msg.includes("foreign key") || msg.includes("23503")) {
    if (msg.includes("item_code")) {
      return "❌ ไม่สามารถเปลี่ยนรหัสสินค้าได้ — มีข้อมูลอ้างอิงไม่ครบหรือรหัสปลายทางซ้ำ";
    }
    if (msg.includes("unit_code") || msg.includes("_unit_code")) {
      return "❌ หน่วยไม่ถูกต้อง — เลือกจากรายการหน่วยสินค้าในระบบ";
    }
    return "❌ ข้อมูลอ้างอิงไม่ถูกต้อง — ตรวจสอบรหัสสินค้า/หน่วย/ร้านค้า";
  }
  return `❌ ${msg}`;
}
