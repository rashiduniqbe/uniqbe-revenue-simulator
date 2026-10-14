export const runtime = "nodejs";

import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordMatches } from "../../../../lib/admin/password";
import { checkLoginAttempt, getLoginStore } from "../../../../lib/admin/rate-limit";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createSessionToken,
  isUsableSecret,
} from "../../../../lib/admin/session";

const MAX_PASSWORD_LENGTH = 256;
const LoginBody = z.object({ password: z.string().min(1).max(MAX_PASSWORD_LENGTH) });

// x-forwarded-for's left-most entry is client-controlled, so it must not key the limiter.
// Vercel sets x-vercel-forwarded-for and x-real-ip itself. Anything that is not a literal
// IP shares one bucket so it cannot be used to mint fresh keys.
function clientId(request: Request): string {
  const candidate = (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    ""
  )
    .split(",")[0]
    ?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : "unknown";
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported media type" }, { status: 415 });
  }

  const expectedPassword = process.env.ADMIN_UPLOAD_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!expectedPassword || !isUsableSecret(sessionSecret)) {
    console.error("admin login: ADMIN_UPLOAD_PASSWORD or ADMIN_SESSION_SECRET is not configured");
    return NextResponse.json({ error: "admin login unavailable" }, { status: 503 });
  }

  const store = getLoginStore();
  if (!store) {
    console.error(
      "admin login: no shared rate-limit store (Upstash Redis) configured in production",
    );
    return NextResponse.json({ error: "admin login unavailable" }, { status: 503 });
  }

  const attempt = await checkLoginAttempt(store, clientId(request));
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "too many attempts" },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
    );
  }

  let body: z.infer<typeof LoginBody>;
  try {
    body = LoginBody.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  if (!(await passwordMatches(body.password, expectedPassword))) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: await createSessionToken(sessionSecret, Date.now()),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return response;
}
