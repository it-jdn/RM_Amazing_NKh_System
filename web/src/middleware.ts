import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getHomePath } from "@/lib/auth/paths";
import { COOKIE_NAME, roleCanAccess } from "@/lib/auth/session";
import type { AppRole } from "@/lib/types";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function verifyToken(token: string) {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.role as AppRole;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const role = token ? await verifyToken(token) : null;

  if (!role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!pathname.startsWith("/api/")) {
    const home = getHomePath(role);
    if (pathname === "/") {
      return NextResponse.redirect(new URL(home, request.url));
    }
    const pagePath = pathname;
    if (!roleCanAccess(pagePath, role)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  } else if (
    pathname.startsWith("/api/users") &&
    !pathname.startsWith("/api/users/me") &&
    role !== "admin"
  ) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  } else if (pathname.startsWith("/api/reports") && role !== "manager" && role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  } else if (pathname.startsWith("/api/suppliers") && role !== "admin" && role !== "manager") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  } else if (
    pathname.startsWith("/api/mapping") &&
    role !== "admin" &&
    role !== "manager"
  ) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
