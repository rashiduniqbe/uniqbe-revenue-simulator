import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as preview } from "../../../src/app/api/admin/pricelist/preview/route";
import { ADMIN_SESSION_COOKIE, createSessionToken } from "../../../src/lib/admin/session";
import { MAX_UPLOAD_BYTES } from "../../../src/lib/admin/pricelist-validate";
import { makeWorkbook, quotationName, validRow } from "../../helpers/make-workbook";

const SECRET = "test-session-secret-0123456789abcdef";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Far-future date so it is newer than whatever price list is currently committed.
const NEWER = quotationName("29991231");

async function uploadRequest(
  options: {
    name?: string;
    bytes?: BlobPart;
    field?: string;
    allowOlder?: boolean;
    auth?: boolean;
    contentLength?: number | null;
  } = {},
): Promise<Request> {
  const form = new FormData();
  const bytes = options.bytes ?? (await makeWorkbook([validRow("ZZ99901", 150)]));
  form.set(options.field ?? "file", new File([bytes], options.name ?? NEWER, { type: XLSX_TYPE }));
  if (options.allowOlder) form.set("allowOlder", "true");
  const headers: Record<string, string> = {};
  if (options.auth !== false) {
    const token = await createSessionToken(SECRET, Date.now());
    headers.cookie = `${ADMIN_SESSION_COOKIE}=${token}`;
  }
  // Browsers send Content-Length for form uploads; Request() does not add it by itself.
  const encoded = new Request("https://example.test/", { method: "POST", body: form });
  const body = await encoded.blob();
  headers["content-type"] = encoded.headers.get("content-type") ?? "";
  if (options.contentLength !== null) {
    headers["content-length"] = String(options.contentLength ?? body.size);
  }
  return new Request("https://example.test/api/admin/pricelist/preview", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/admin/pricelist/preview", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SESSION_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an unauthenticated request even if middleware is bypassed", async () => {
    const response = await preview(await uploadRequest({ auth: false }));
    expect(response.status).toBe(401);
  });

  it("returns a diff for a valid upload", async () => {
    const response = await preview(await uploadRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.newPriceListDate).toBe("2999-12-31");
    expect(body.diff.added.map((i: { code: string }) => i.code)).toContain("ZZ99901");
    expect(Array.isArray(body.warnings)).toBe(true);
  });

  it("rejects a file that is not named like a quotation, with every reason", async () => {
    const response = await preview(await uploadRequest({ name: "prices.xlsx" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errors.join(" ")).toMatch(/Uniqbe Reseller Quotation YYYYMMDD\.xlsx/);
  });

  it("rejects content that is not a zip container", async () => {
    const response = await preview(await uploadRequest({ bytes: "MZ definitely not a workbook" }));
    expect(response.status).toBe(400);
    expect((await response.json()).errors.join(" ")).toMatch(/not a valid \.xlsx/);
  });

  it("returns 400 when no file field is present", async () => {
    const response = await preview(await uploadRequest({ field: "other" }));
    expect(response.status).toBe(400);
  });

  it("returns 413 without reading the body when content-length is over the cap", async () => {
    const response = await preview(await uploadRequest({ contentLength: MAX_UPLOAD_BYTES * 2 }));
    expect(response.status).toBe(413);
  });

  it.each([null, Number.NaN, -1])(
    "returns 411 when content-length is missing or invalid (%s)",
    async (contentLength) => {
      const request = await uploadRequest({ contentLength });
      if (Number.isNaN(contentLength)) request.headers.set("content-length", "abc");
      expect((await preview(request)).status).toBe(411);
    },
  );

  it("rejects an older price list unless allowOlder is set", async () => {
    const old = quotationName("20200101");
    const blocked = await preview(await uploadRequest({ name: old }));
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).errors.join(" ")).toMatch(/not newer/);
    const allowed = await preview(await uploadRequest({ name: old, allowOlder: true }));
    expect(allowed.status).toBe(200);
  });

  it("returns the unmapped-category instruction verbatim", async () => {
    const bytes = await makeWorkbook([["ZZ99901", "B", "Thing", "Drones", 100, 780]]);
    const response = await preview(await uploadRequest({ bytes }));
    expect(response.status).toBe(400);
    expect((await response.json()).errors.join("\n")).toMatch(/Unmapped category "Drones"/);
  });
});
