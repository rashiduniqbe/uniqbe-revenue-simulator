import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./lib/admin/session";

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

const LOGIN_PAGE = "/admin/login";
const PUBLIC_PATHS = new Set([LOGIN_PAGE, "/api/admin/login", "/api/admin/logout"]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const NOINDEX = "noindex, nofollow";

// State-changing requests must prove they are same-origin: a matching Origin header, or,
// when a browser omits Origin, Sec-Fetch-Site: same-origin. Anything else is rejected.
function isUntrustedWrite(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const origin = request.headers.get("origin");
  if (origin !== null) return origin !== request.nextUrl.origin;
  return request.headers.get("sec-fetch-site") !== "same-origin";
}

async function decide(request: NextRequest): Promise<NextResponse> {
  if (isUntrustedWrite(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (PUBLIC_PATHS.has(path)) return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, process.env.ADMIN_SESSION_SECRET, Date.now())) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL(LOGIN_PAGE, request.url));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const response = await decide(request);
  response.headers.set("X-Robots-Tag", NOINDEX);
  return response;
}
