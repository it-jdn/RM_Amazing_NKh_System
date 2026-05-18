import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AppRole, SessionPayload } from "@/lib/types";

const COOKIE_NAME = "rm_session";
const MAX_AGE = 60 * 60 * 24; // 24h

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: String(payload.userId),
      displayName: String(payload.displayName),
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { COOKIE_NAME, MAX_AGE };

export const ROLE_PAGES: Record<string, AppRole[]> = {
  "/history": ["operator", "admin", "manager"],
  "/intake": ["operator", "admin", "manager"],
  "/admin": ["admin", "manager"],
  "/report": ["manager", "admin"],
};

export function roleCanAccess(path: string, role: AppRole): boolean {
  if (path === "/admin/users" || path.startsWith("/admin/users/")) {
    return role === "admin";
  }
  if (path === "/admin/units" || path.startsWith("/admin/units/")) {
    return role === "admin";
  }
  if (path === "/admin" || path.startsWith("/admin/")) {
    const allowed = ROLE_PAGES["/admin"];
    return allowed?.includes(role) ?? false;
  }
  const allowed = ROLE_PAGES[path];
  if (!allowed) return true;
  return allowed.includes(role);
}

export function roleCanAccessApi(pathname: string, role: AppRole): boolean {
  if (pathname.startsWith("/api/users/me")) return true;
  if (pathname.startsWith("/api/users")) return role === "admin";
  if (pathname.startsWith("/api/reports")) return role === "manager" || role === "admin";
  if (pathname.startsWith("/api/suppliers")) {
    return role === "admin" || role === "manager";
  }
  if (pathname.startsWith("/api/items")) {
    return role === "operator" || role === "admin" || role === "manager";
  }
  if (pathname.startsWith("/api/mapping")) {
    return role === "admin" || role === "manager";
  }
  if (pathname.startsWith("/api/admin/units")) {
    return role === "admin";
  }
  if (pathname.startsWith("/api/units/pairs")) {
    return role === "operator" || role === "admin" || role === "manager";
  }
  if (pathname.startsWith("/api/units")) {
    return role === "admin" || role === "manager";
  }
  if (pathname.startsWith("/api/products")) {
    return role === "admin" || role === "manager";
  }
  return true;
}
