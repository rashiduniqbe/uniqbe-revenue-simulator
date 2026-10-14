import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "../../../src/lib/admin/session";

const SECRET = "test-secret-with-enough-length-0123456789";
const NOW_MS = 1_800_000_000_000;

describe("admin session token", () => {
  it("verifies a freshly created token", async () => {
    const token = await createSessionToken(SECRET, NOW_MS);
    expect(await verifySessionToken(token, SECRET, NOW_MS + 1000)).toBe(true);
  });

  it("rejects a token after the TTL has elapsed", async () => {
    const token = await createSessionToken(SECRET, NOW_MS);
    const afterExpiry = NOW_MS + ADMIN_SESSION_TTL_SECONDS * 1000 + 1;
    expect(await verifySessionToken(token, SECRET, afterExpiry)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET, NOW_MS);
    expect(await verifySessionToken(token, "another-secret-0123456789abcdef", NOW_MS)).toBe(false);
  });

  it("rejects a token whose payload was tampered with", async () => {
    const token = await createSessionToken(SECRET, NOW_MS);
    const [, signature] = token.split(".");
    const forgedPayload = btoa(JSON.stringify({ exp: NOW_MS + 10 ** 12 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifySessionToken(`${forgedPayload}.${signature}`, SECRET, NOW_MS)).toBe(false);
  });

  it.each([undefined, "", "no-dot", "a.b.c", ".", "....", "%%%.%%%"])(
    "rejects malformed token %j",
    async (token) => {
      expect(await verifySessionToken(token, SECRET, NOW_MS)).toBe(false);
    },
  );

  it("rejects everything when the secret is missing or empty", async () => {
    const token = await createSessionToken(SECRET, NOW_MS);
    expect(await verifySessionToken(token, undefined, NOW_MS)).toBe(false);
    expect(await verifySessionToken(token, "", NOW_MS)).toBe(false);
  });

  it("refuses to create a token without a usable secret", async () => {
    await expect(createSessionToken("", NOW_MS)).rejects.toThrow(/secret/i);
  });
});
