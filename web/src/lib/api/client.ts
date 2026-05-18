import { messageFromApiBody } from "@/lib/db/postgres-error";

function apiFailureMessage(data: unknown, res: Response): string {
  return messageFromApiBody(data) || res.statusText || "❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์";
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(apiFailureMessage(data, res));
  return data as T;
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(apiFailureMessage(data, res));
  return data as T;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(apiFailureMessage(data, res));
  return data as T;
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(apiFailureMessage(data, res));
  return data as T;
}
