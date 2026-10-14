import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminSession } from "../../../src/lib/admin/guard";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "../../../src/lib/admin/session";

const SECRET = "test-session-secret-0123456789abcdef";

function request(cookie?: string): Request {
  return new Request("https://example.test/api/admin/pricelist/preview", {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
  });
}

describe("requireAdminSession", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SESSION_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("returns null for a valid session among other cookies", async () => {
    const token = await createSessionToken(SECRET, Date.now());
    const result = await requireAdminSession(
      request(`theme=dark; ${ADMIN_SESSION_COOKIE}=${token}; other=1`),
    );
    expect(result).toBeNull();
  });

  it("returns 401 with no cookie", async () => {
    const result = await requireAdminSession(request());
    expect(result?.status).toBe(401);
  });

  it("returns 401 for a forged cookie", async () => {
    const result = await requireAdminSession(request(`${ADMIN_SESSION_COOKIE}=forged.value`));
    expect(result?.status).toBe(401);
  });

  it("returns 401 when the secret is not configured, even with a once-valid token", async () => {
    const token = await createSessionToken(SECRET, Date.now());
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    const result = await requireAdminSession(request(`${ADMIN_SESSION_COOKIE}=${token}`));
    expect(result?.status).toBe(401);
  });
});
