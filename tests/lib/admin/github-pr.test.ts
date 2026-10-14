import { describe, expect, it } from "vitest";
import {
  GithubError,
  createPricelistPr,
  parseGithubRepo,
  type PricelistPrInput,
} from "../../../src/lib/admin/github-pr";
import { createFakeGithub } from "../../helpers/fake-github";

const REPO = "example-owner/example-repo";
const TOKEN = "ghp_fake_token_for_tests";

function input(overrides: Partial<PricelistPrInput> = {}): PricelistPrInput {
  return {
    filename: "Uniqbe Reseller Quotation 20261110.xlsx",
    xlsx: Buffer.from("fake xlsx bytes"),
    catalogueJson: '{"fake":"catalogue"}',
    priceListDate: "2026-11-10",
    currentPriceListDate: "2026-10-13",
    diffSummary: "1 added, 0 removed, 2 repriced",
    bodyDetails: "details",
    ...overrides,
  };
}

const config = (fakeFetch: typeof fetch) => ({
  repo: REPO,
  token: TOKEN,
  baseBranch: "main",
  fetch: fakeFetch,
});

describe("parseGithubRepo", () => {
  it.each(["owner/repo", "my-org/my.repo_1"])("accepts %s", (value) => {
    expect(parseGithubRepo(value)).toBe(value);
  });

  it.each([
    undefined,
    "",
    "owner",
    "owner/repo/extra",
    "../repo",
    "owner/..",
    "o wner/repo",
    "a/b?x=1",
  ])("rejects %j", (value) => {
    expect(parseGithubRepo(value)).toBeNull();
  });
});

describe("createPricelistPr", () => {
  it("commits the xlsx and catalogue.json on pricelist/YYYYMMDD and opens a PR", async () => {
    const github = createFakeGithub({ repo: REPO });
    const result = await createPricelistPr(input(), config(github.fetch));

    expect(result).toEqual({
      prUrl: "https://github.com/example-owner/example-repo/pull/42",
      prNumber: 42,
      alreadyExisted: false,
    });

    const [tree] = github.callsMatching("POST", "/git/trees");
    const paths = (tree?.body as { tree: { path: string }[] }).tree.map((t) => t.path).sort();
    expect(paths).toEqual([
      "pricelists/Uniqbe Reseller Quotation 20261110.xlsx",
      "src/data/catalogue.json",
    ]);
    expect((tree?.body as { base_tree: string }).base_tree).toBe(github.constants.BASE_TREE);

    const blobs = github
      .callsMatching("POST", "/git/blobs")
      .map((c) => c.body as { content: string });
    expect(blobs.map((b) => b.content)).toContain('{"fake":"catalogue"}');
    expect(blobs.map((b) => b.content)).toContain(
      Buffer.from("fake xlsx bytes").toString("base64"),
    );

    const [commit] = github.callsMatching("POST", "/git/commits");
    expect((commit?.body as { parents: string[] }).parents).toEqual([github.constants.BASE_SHA]);
    expect((commit?.body as { message: string }).message).toMatch(
      /^chore\(catalogue\): reseller price list 20261110/,
    );

    const [ref] = github.callsMatching("POST", "/git/refs");
    expect((ref?.body as { ref: string }).ref).toBe("refs/heads/pricelist/20261110");

    const [pr] = github.callsMatching("POST", "/pulls");
    expect(pr?.body).toMatchObject({
      title: "chore(catalogue): reseller price list 20261110",
      head: "pricelist/20261110",
      base: "main",
    });
    expect((pr?.body as { body: string }).body).toContain("1 added, 0 removed, 2 repriced");
  });

  it("returns the existing PR without writing anything when one is already open", async () => {
    const github = createFakeGithub({
      repo: REPO,
      existingPr: { html_url: "https://github.com/example-owner/example-repo/pull/7", number: 7 },
    });
    const result = await createPricelistPr(input(), config(github.fetch));
    expect(result).toEqual({
      prUrl: "https://github.com/example-owner/example-repo/pull/7",
      prNumber: 7,
      alreadyExisted: true,
    });
    expect(github.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("refuses to touch an existing branch that has no open PR, and writes nothing", async () => {
    const github = createFakeGithub({ repo: REPO, existingBranches: ["pricelist/20261110"] });
    const error = await createPricelistPr(input(), config(github.fetch)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GithubError);
    expect((error as GithubError).status).toBe(409);
    expect((error as GithubError).message).toContain("pricelist/20261110");
    expect(github.calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("returns the PR a concurrent request opened instead of failing on the duplicate", async () => {
    const racePr = { html_url: "https://github.com/example-owner/example-repo/pull/9", number: 9 };
    const github = createFakeGithub({ repo: REPO, racePr });
    const result = await createPricelistPr(input(), config(github.fetch));
    expect(result).toEqual({ prUrl: racePr.html_url, prNumber: 9, alreadyExisted: true });
  });

  it("bounds every GitHub call with a timeout and refuses redirects", async () => {
    const github = createFakeGithub({ repo: REPO });
    await createPricelistPr(input(), config(github.fetch));
    expect(github.calls.length).toBeGreaterThan(0);
    for (const call of github.calls) {
      expect(call.hasSignal).toBe(true);
      expect(call.redirect).toBe("error");
    }
  });

  it.each([
    "http://github.com/example-owner/example-repo/pull/1",
    "https://evil.test/pull/1",
    "javascript:alert(1)",
  ])("rejects a PR url that is not on https://github.com/ (%s)", async (url) => {
    const github = createFakeGithub({ repo: REPO, createdPrUrl: url });
    await expect(createPricelistPr(input(), config(github.fetch))).rejects.toBeInstanceOf(
      GithubError,
    );
  });

  it("rejects an existing-PR url that is not on https://github.com/", async () => {
    const github = createFakeGithub({
      repo: REPO,
      existingPr: { html_url: "https://evil.test/pull/1", number: 1 },
    });
    await expect(createPricelistPr(input(), config(github.fetch))).rejects.toBeInstanceOf(
      GithubError,
    );
  });

  it("sends the token only to api.github.com", async () => {
    const github = createFakeGithub({ repo: REPO });
    await createPricelistPr(input(), config(github.fetch));
    for (const call of github.calls) {
      expect(new URL(call.url).origin).toBe("https://api.github.com");
      expect(call.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("throws a GithubError that never contains the token when GitHub fails", async () => {
    const github = createFakeGithub({ repo: REPO, failOn: "POST /git/commits" });
    const error = await createPricelistPr(input(), config(github.fetch)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GithubError);
    expect(String((error as GithubError).message)).not.toContain(TOKEN);
    expect((error as GithubError).status).toBe(500);
    expect(github.callsMatching("POST", "/pulls")).toHaveLength(0);
  });

  it("caps the PR body so a huge diff cannot exceed GitHub's limit", async () => {
    const github = createFakeGithub({ repo: REPO });
    await createPricelistPr(input({ bodyDetails: "x".repeat(200_000) }), config(github.fetch));
    const [pr] = github.callsMatching("POST", "/pulls");
    const body = (pr?.body as { body: string }).body;
    expect(body.length).toBeLessThan(65_536);
    expect(body).toMatch(/truncated/i);
  });

  it("refuses a filename that is not a safe price-list name", async () => {
    const github = createFakeGithub({ repo: REPO });
    await expect(
      createPricelistPr(input({ filename: "../../etc/passwd.xlsx" }), config(github.fetch)),
    ).rejects.toThrow(/filename/i);
    expect(github.calls).toEqual([]);
  });
});
