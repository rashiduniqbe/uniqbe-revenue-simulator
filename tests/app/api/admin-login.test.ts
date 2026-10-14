import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "../../../src/app/api/admin/login/route";
import { POST as logout } from "../../../src/app/api/admin/logout/route";
import { LOGIN_MAX_ATTEMPTS, resetMemoryLoginStore } from "../../../src/lib/admin/rate-limit";
import { verifySessionToken } from "../../../src/lib/admin/session";

const PASSWORD = "correct horse battery";
const SECRET = "test-session-secret-0123456789abcdef";

function loginRequest(body: unknown, init: { contentType?: string; ip?: string } = {}): Request {
  return new Request("https://example.test/api/admin/login", {
    method: "POST",
    headers: {
      "content-type": init.contentType ?? "application/json",
      "x-vercel-forwarded-for": init.ip ?? "9.9.9.9",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function sessionCookie(response: Response): string | undefined {
  const header = response.headers.get("set-cookie") ?? "";
  return /admin_session=([^;]*)/.exec(header)?.[1];
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_UPLOAD_PASSWORD", PASSWORD);
    vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetMemoryLoginStore();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sets a signed, httpOnly, SameSite=Strict session cookie on the right password", async () => {
    const response = await login(loginRequest({ password: PASSWORD }));
    expect(response.status).toBe(200);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=strict/i);
    expect(header).toMatch(/Path=\//i);
    expect(header).toMatch(/Max-Age=\d+/i);
    const token = sessionCookie(response);
    expect(token).toBeTruthy();
    expect(await verifySessionToken(token, SECRET, Date.now())).toBe(true);
  });

  it("rejects a wrong password with 401 and no cookie", async () => {
    const response = await login(loginRequest({ password: "nope" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a non-JSON content type with 415", async () => {
    const response = await login(
      loginRequest(`password=${PASSWORD}`, { contentType: "application/x-www-form-urlencoded" }),
    );
    expect(response.status).toBe(415);
  });

  it.each([{}, { password: 5 }, { password: "" }, { password: "x".repeat(1000) }, "not json"])(
    "rejects malformed body %j with 400",
    async (body) => {
      const response = await login(loginRequest(body));
      expect(response.status).toBe(400);
    },
  );

  it("fails closed with 503 when the password or secret is not configured", async () => {
    vi.stubEnv("ADMIN_UPLOAD_PASSWORD", "");
    expect((await login(loginRequest({ password: "x" }))).status).toBe(503);
    vi.stubEnv("ADMIN_UPLOAD_PASSWORD", PASSWORD);
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect((await login(loginRequest({ password: PASSWORD }))).status).toBe(503);
  });

  it("rate limits repeated attempts from one client with 429 and Retry-After", async () => {
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      await login(loginRequest({ password: "nope" }));
    }
    const blocked = await login(loginRequest({ password: PASSWORD }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.headers.get("set-cookie")).toBeNull();
  });

  it("ignores a client-supplied X-Forwarded-For so the limit cannot be dodged", async () => {
    const attempt = (spoof: string) =>
      login(
        new Request("https://example.test/api/admin/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": spoof,
            "x-vercel-forwarded-for": "203.0.113.7",
          },
          body: JSON.stringify({ password: "nope" }),
        }),
      );
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) await attempt(`198.51.100.${i}`);
    expect((await attempt("198.51.100.200")).status).toBe(429);
  });

  it("treats a non-IP client id as one shared bucket", async () => {
    const attempt = () =>
      login(loginRequest({ password: "nope" }, { ip: "not an ip".repeat(1000) }));
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) await attempt();
    expect((await attempt()).status).toBe(429);
  });

  it("denies login in production when no shared rate-limit store is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await login(loginRequest({ password: PASSWORD }));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not leak which environment variable is missing", async () => {
    vi.stubEnv("ADMIN_UPLOAD_PASSWORD", "");
    const response = await login(loginRequest({ password: "x" }));
    expect(await response.text()).not.toMatch(/ADMIN_/);
  });
});

describe("POST /api/admin/logout", () => {
  it("expires the session cookie", async () => {
    const response = await logout();
    expect(response.status).toBe(200);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/admin_session=;/);
    expect(header).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
