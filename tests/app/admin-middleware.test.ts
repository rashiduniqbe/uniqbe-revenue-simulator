import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, middleware } from "../../src/middleware";
import { createSessionToken } from "../../src/lib/admin/session";

const SECRET = "test-session-secret-0123456789abcdef";

function req(path: string, init: { method?: string; cookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = {};
  if (init.cookie) headers.cookie = `admin_session=${init.cookie}`;
  if (init.origin) headers.origin = init.origin;
  return new NextRequest(`https://example.test${path}`, { method: init.method ?? "GET", headers });
}

describe("admin middleware", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SESSION_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a state-changing request that carries no Origin header", async () => {
    const cookie = await createSessionToken(SECRET, Date.now());
    const response = await middleware(
      req("/api/admin/pricelist/publish", { method: "POST", cookie }),
    );
    expect(response.status).toBe(403);
  });

  it("accepts a same-site state-changing request that omits Origin but sends Sec-Fetch-Site", async () => {
    const cookie = await createSessionToken(SECRET, Date.now());
    const request = new NextRequest("https://example.test/api/admin/pricelist/publish", {
      method: "POST",
      headers: { cookie: `admin_session=${cookie}`, "sec-fetch-site": "same-origin" },
    });
    expect((await middleware(request)).headers.get("x-middleware-next")).toBe("1");
  });

  it("only matches admin paths", () => {
    expect(config.matcher).toEqual(["/admin/:path*", "/api/admin/:path*"]);
  });

  it("redirects an unauthenticated page request to the login page", async () => {
    const response = await middleware(req("/admin"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/admin/login");
  });

  it("returns 401 JSON, not a redirect, for an unauthenticated API request", async () => {
    const response = await middleware(
      req("/api/admin/pricelist/preview", { method: "POST", origin: "https://example.test" }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("lets the login page and login endpoint through without a session", async () => {
    expect((await middleware(req("/admin/login"))).headers.get("x-middleware-next")).toBe("1");
    expect(
      (
        await middleware(
          req("/api/admin/login", { method: "POST", origin: "https://example.test" }),
        )
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });

  it("lets a valid session through", async () => {
    const cookie = await createSessionToken(SECRET, Date.now());
    const response = await middleware(req("/admin", { cookie }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects a tampered session cookie", async () => {
    const cookie = `${await createSessionToken(SECRET, Date.now())}x`;
    const response = await middleware(req("/api/admin/pricelist/preview", { cookie }));
    expect(response.status).toBe(401);
  });

  it("rejects an expired session cookie", async () => {
    const cookie = await createSessionToken(SECRET, Date.now() - 24 * 60 * 60 * 1000);
    const response = await middleware(req("/admin", { cookie }));
    expect(response.status).toBe(307);
  });

  it("fails closed when the session secret is not configured", async () => {
    const cookie = await createSessionToken(SECRET, Date.now());
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    const response = await middleware(req("/api/admin/pricelist/preview", { cookie }));
    expect(response.status).toBe(401);
  });

  it("blocks a cross-origin state-changing request even with a valid session", async () => {
    const cookie = await createSessionToken(SECRET, Date.now());
    const response = await middleware(
      req("/api/admin/pricelist/publish", {
        method: "POST",
        cookie,
        origin: "https://evil.test",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("allows a same-origin state-changing request", async () => {
    const cookie = await createSessionToken(SECRET, Date.now());
    const response = await middleware(
      req("/api/admin/pricelist/publish", {
        method: "POST",
        cookie,
        origin: "https://example.test",
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("marks every admin response noindex", async () => {
    const redirect = await middleware(req("/admin"));
    const denied = await middleware(req("/api/admin/x", { method: "POST" }));
    const passed = await middleware(req("/admin/login"));
    for (const response of [redirect, denied, passed]) {
      expect(response.headers.get("x-robots-tag")).toMatch(/noindex/);
    }
  });
});
