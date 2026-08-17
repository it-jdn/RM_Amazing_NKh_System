import { messageFromApiBody } from "@/lib/db/postgres-error";

async function parseApiJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function apiFailureMessage(data: unknown, res: Response): string {
  const fromBody = messageFromApiBody(data);
  if (fromBody) return fromBody;
  if (res.status >= 500) {
    return "เซิร์ฟเวอร์ไม่ตอบสนองชั่วคราว — ลอง Refresh อีกครั้ง";
  }
  if (res.status === 401) return "กรุณาเข้าสู่ระบบใหม่";
  return res.statusText || "❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์";
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const data = await parseApiJson(res);
  if (!res.ok) throw new Error(apiFailureMessage(data, res));
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "DELETE" });
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
