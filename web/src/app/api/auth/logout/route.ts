import { COOKIE_NAME } from "@/lib/auth/session";
import { jsonOk } from "@/lib/api/response";

export async function POST() {
  const res = jsonOk({ success: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
