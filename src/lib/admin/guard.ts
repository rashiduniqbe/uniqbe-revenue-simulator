import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./session";

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

/**
 * Route-level session check. middleware.ts already guards /api/admin, but every admin
 * handler re-checks so a matcher regression cannot silently expose it.
 * Returns null when the caller is signed in, otherwise a 401 response to return as-is.
 */
export async function requireAdminSession(request: Request): Promise<Response | null> {
  const token = readCookie(request, ADMIN_SESSION_COOKIE);
  if (await verifySessionToken(token, process.env.ADMIN_SESSION_SECRET, Date.now())) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
