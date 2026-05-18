import type { AppRole } from "@/lib/types";
import { daysAgoISO, todayISO } from "@/lib/utils/format";

export const OPERATOR_DELETE_DAYS = 7;

/** operator ลบได้เฉพาะย้อนหลังไม่เกิน 7 วัน; admin/manager ลบได้ทุกวัน */
export function canDeleteIntakeBatch(role: AppRole, date: string): boolean {
  if (role === "admin" || role === "manager") return true;
  if (role !== "operator") return false;
  const min = daysAgoISO(OPERATOR_DELETE_DAYS);
  const max = todayISO();
  return date >= min && date <= max;
}

export function deleteIntakeBatchDeniedMessage(role: AppRole): string {
  if (role === "operator") {
    return `พนักงานร้านลบได้เฉพาะย้อนหลังไม่เกิน ${OPERATOR_DELETE_DAYS} วัน — ติดต่อแอดมินหากต้องการลบเก่ากว่านั้น`;
  }
  return "ไม่มีสิทธิ์ลบข้อมูล";
}
