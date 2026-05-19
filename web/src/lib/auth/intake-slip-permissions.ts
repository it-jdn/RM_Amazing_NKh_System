import type { AppRole, SessionPayload } from "@/lib/types";
import { canDeleteIntakeBatch, deleteIntakeBatchDeniedMessage } from "@/lib/auth/intake-permissions";

export type IntakeSlipOwner = {
  createdByUserId: string | null;
  txnDate: string;
};

/** operator: แก้ไขได้เฉพาะใบที่ตัวเองสร้าง; admin/manager แก้ไขได้ทุกใบ */
export function canEditIntakeSlip(session: SessionPayload, slip: IntakeSlipOwner): boolean {
  if (session.role === "admin" || session.role === "manager") return true;
  if (session.role !== "operator") return false;
  if (!slip.createdByUserId) return true;
  return slip.createdByUserId === session.userId;
}

export function editIntakeSlipDeniedMessage(): string {
  return "แก้ไขได้เฉพาะใบรับของที่คุณเป็นผู้บันทึก — ติดต่อผู้จัดการหรือแอดมินหากต้องการแก้ไข";
}

export function canDeleteIntakeSlip(
  session: SessionPayload,
  slip: IntakeSlipOwner
): boolean {
  if (!canDeleteIntakeBatch(session.role, slip.txnDate)) return false;
  if (session.role === "admin" || session.role === "manager") return true;
  if (!slip.createdByUserId) return true;
  return slip.createdByUserId === session.userId;
}

export function deleteIntakeSlipDeniedMessage(role: AppRole): string {
  if (role === "operator") {
    return editIntakeSlipDeniedMessage();
  }
  return deleteIntakeBatchDeniedMessage(role);
}
