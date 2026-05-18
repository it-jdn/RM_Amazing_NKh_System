import bcrypt from "bcryptjs";

const MIN_PIN_LENGTH = 4;

export function validatePin(pin: string): string | null {
  const trimmed = pin.trim();
  if (trimmed.length < MIN_PIN_LENGTH) {
    return `PIN ต้องมีอย่างน้อย ${MIN_PIN_LENGTH} หลัก`;
  }
  if (!/^\d+$/.test(trimmed)) {
    return "PIN ต้องเป็นตัวเลขเท่านั้น";
  }
  return null;
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin.trim(), 10);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin.trim(), pinHash);
}
