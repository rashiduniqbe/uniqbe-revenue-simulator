export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "../../../../lib/admin/session";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
