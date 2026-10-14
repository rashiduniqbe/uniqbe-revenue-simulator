import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createPricelistPr = vi.fn();
vi.mock("../../../src/lib/admin/github-pr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/admin/github-pr")>()),
  createPricelistPr: (...args: unknown[]) => createPricelistPr(...args),
}));

import { POST as publish } from "../../../src/app/api/admin/pricelist/publish/route";
import { GithubError } from "../../../src/lib/admin/github-pr";
import { makeWorkbook, quotationName } from "../../helpers/make-workbook";
import { SESSION_SECRET, uploadRequest } from "../../helpers/upload-request";

const PATH = "/api/admin/pricelist/publish";
const TOKEN = "ghp_fake_token_for_tests";
const PR = { prUrl: "https://github.com/example-owner/example-repo/pull/42", prNumber: 42 };

describe("POST /api/admin/pricelist/publish", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", SESSION_SECRET);
    vi.stubEnv("GITHUB_PRICELIST_TOKEN", TOKEN);
    vi.stubEnv("GITHUB_REPO", "example-owner/example-repo");
    createPricelistPr.mockResolvedValue({ ...PR, alreadyExisted: false });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated request without calling GitHub", async () => {
    const response = await publish(await uploadRequest({ path: PATH, auth: false }));
    expect(response.status).toBe(401);
    expect(createPricelistPr).not.toHaveBeenCalled();
  });

  it.each([
    ["GITHUB_PRICELIST_TOKEN", ""],
    ["GITHUB_REPO", ""],
    ["GITHUB_REPO", "not a repo"],
  ])("returns 503 and calls nothing when %s is %j", async (name, value) => {
    vi.stubEnv(name, value);
    const response = await publish(await uploadRequest({ path: PATH }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("GITHUB_");
    expect(createPricelistPr).not.toHaveBeenCalled();
  });

  it("re-validates the upload and refuses an invalid file", async () => {
    const response = await publish(await uploadRequest({ path: PATH, name: "prices.xlsx" }));
    expect(response.status).toBe(400);
    expect(createPricelistPr).not.toHaveBeenCalled();
  });

  it("refuses a price list that is not newer unless explicitly allowed", async () => {
    const old = quotationName("20200101");
    const blocked = await publish(await uploadRequest({ path: PATH, name: old }));
    expect(blocked.status).toBe(400);
    expect(createPricelistPr).not.toHaveBeenCalled();
    const allowed = await publish(await uploadRequest({ path: PATH, name: old, allowOlder: true }));
    expect(allowed.status).toBe(200);
  });

  it("refuses a workbook that fails the build, such as an unmapped category", async () => {
    const bytes = await makeWorkbook([["ZZ99901", "B", "Thing", "Drones", 100, 780]]);
    const response = await publish(await uploadRequest({ path: PATH, bytes }));
    expect(response.status).toBe(400);
    expect(createPricelistPr).not.toHaveBeenCalled();
  });

  it("requires a content-length like the preview endpoint", async () => {
    const response = await publish(await uploadRequest({ path: PATH, contentLength: null }));
    expect(response.status).toBe(411);
  });

  it("opens the PR with the validated catalogue and original workbook", async () => {
    const response = await publish(await uploadRequest({ path: PATH }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ...PR, alreadyExisted: false });

    const [input, config] = createPricelistPr.mock.calls[0] ?? [];
    expect(input.filename).toBe("Uniqbe Reseller Quotation 29991231.xlsx");
    expect(Buffer.isBuffer(input.xlsx)).toBe(true);
    expect(input.priceListDate).toBe("2999-12-31");
    const catalogue = JSON.parse(input.catalogueJson);
    expect(catalogue.priceListDate).toBe("2999-12-31");
    expect(catalogue.items.map((i: { code: string }) => i.code)).toContain("ZZ99901");
    expect(input.diffSummary).toMatch(/\d+ added, \d+ removed, \d+ repriced/);
    expect(config).toMatchObject({
      repo: "example-owner/example-repo",
      token: TOKEN,
      baseBranch: "main",
    });
  });

  it("reports an already-open PR to the caller", async () => {
    createPricelistPr.mockResolvedValue({ ...PR, alreadyExisted: true });
    const body = await (await publish(await uploadRequest({ path: PATH }))).json();
    expect(body.alreadyExisted).toBe(true);
  });

  it("tells the operator when a leftover branch blocks publishing", async () => {
    createPricelistPr.mockRejectedValue(
      new GithubError(
        "Branch pricelist/29991231 already exists without an open pull request.",
        409,
      ),
    );
    const response = await publish(await uploadRequest({ path: PATH }));
    expect(response.status).toBe(409);
    expect((await response.json()).errors.join(" ")).toContain("pricelist/29991231");
  });

  it("returns a generic 502 without leaking GitHub details or the token", async () => {
    createPricelistPr.mockRejectedValue(new GithubError("GitHub API POST /pulls failed", 422));
    const response = await publish(await uploadRequest({ path: PATH }));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(TOKEN);
    expect(text).not.toMatch(/422|pulls/);
  });
});
