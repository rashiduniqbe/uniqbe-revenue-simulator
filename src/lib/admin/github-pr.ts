// Opens the monthly price-list pull request through the GitHub REST API. Plain fetch, no SDK,
// and the fetch implementation is injectable so tests can run against a fake.
import { z } from "zod";

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2022-11-28";
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const FILENAME_PATTERN = /^Uniqbe Reseller Quotation (\d{8})\.xlsx$/;
const DEFAULT_BASE_BRANCH = "main";
const CATALOGUE_PATH = "src/data/catalogue.json";
const MAX_PR_BODY_CHARS = 60_000;
const BAD_GATEWAY = 502;
export const CONFLICT = 409;
const UNPROCESSABLE = 422;
const GITHUB_TIMEOUT_MS = 15_000;
const PR_URL_PREFIX = "https://github.com/";

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

export type GithubConfig = {
  repo: string;
  token: string;
  baseBranch: string;
  fetch?: typeof fetch;
};

export type PricelistPrInput = {
  filename: string;
  xlsx: Buffer;
  catalogueJson: string;
  priceListDate: string;
  currentPriceListDate: string;
  diffSummary: string;
  bodyDetails: string;
};

export type PricelistPrResult = { prUrl: string; prNumber: number; alreadyExisted: boolean };

const Sha = z.object({ sha: z.string() });
const RefResponse = z.object({ object: Sha });
const CommitResponse = z.object({ tree: Sha });
// The link is shown to the operator as an href, so it must really point at github.com.
const PullResponse = z.object({
  html_url: z.string().url().startsWith(PR_URL_PREFIX),
  number: z.number(),
});
const PullList = z.array(PullResponse);

export function parseGithubRepo(value: string | undefined): string | null {
  if (!value || !REPO_PATTERN.test(value)) return null;
  return value.split("/").some((part) => part === "." || part === "..") ? null : value;
}

/** Reads the publish settings from the environment, or null when publishing is not configured. */
export function readGithubConfig(
  env: Record<string, string | undefined> = process.env,
): GithubConfig | null {
  const token = env.GITHUB_PRICELIST_TOKEN;
  const repo = parseGithubRepo(env.GITHUB_REPO);
  const baseBranch = env.GITHUB_BASE_BRANCH || DEFAULT_BASE_BRANCH;
  if (!token || !repo || !BRANCH_PATTERN.test(baseBranch) || baseBranch.includes("..")) return null;
  return { repo, token, baseBranch };
}

const encodeRef = (ref: string): string => ref.split("/").map(encodeURIComponent).join("/");

function send(
  config: GithubConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return (config.fetch ?? fetch)(`${API_ORIGIN}/repos/${config.repo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": API_VERSION,
      "content-type": "application/json",
      "user-agent": "uniqbe-price-simulator",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Bounded, never followed to another host, never cached.
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });
}

// The status and route are enough to debug; GitHub's response body is never echoed.
function assertOk(response: Response, method: string, path: string): void {
  if (!response.ok) {
    throw new GithubError(
      `GitHub API ${method} ${path} failed with status ${response.status}`,
      response.status,
    );
  }
}

async function call<T>(
  config: GithubConfig,
  method: string,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const response = await send(config, method, path, body);
  assertOk(response, method, path);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new GithubError(
      `GitHub API ${method} ${path} returned an unexpected response`,
      BAD_GATEWAY,
    );
  }
  return parsed.data;
}

async function branchExists(config: GithubConfig, branch: string): Promise<boolean> {
  const path = `/git/ref/heads/${encodeRef(branch)}`;
  const response = await send(config, "GET", path);
  if (response.status === 404) return false;
  assertOk(response, "GET", path);
  return true;
}

function truncateBody(text: string): string {
  return text.length > MAX_PR_BODY_CHARS
    ? `${text.slice(0, MAX_PR_BODY_CHARS)}\n… (truncated)`
    : text;
}

/**
 * Commits the workbook and regenerated catalogue.json to pricelist/YYYYMMDD in one commit and
 * opens a PR. Safe to repeat: an open PR for the branch is returned untouched. An existing
 * branch with no open PR is never overwritten (it may hold someone's work), so the call stops
 * with a 409 before writing anything.
 */
export async function createPricelistPr(
  input: PricelistPrInput,
  config: GithubConfig,
): Promise<PricelistPrResult> {
  const stamp = FILENAME_PATTERN.exec(input.filename)?.[1];
  if (!stamp) throw new Error("Refusing to publish: unsafe price list filename.");
  const branch = `pricelist/${stamp}`;
  const title = `chore(catalogue): reseller price list ${stamp}`;
  const owner = config.repo.split("/")[0] ?? "";

  const findOpenPr = async (): Promise<PricelistPrResult | null> => {
    const [open] = await call(
      config,
      "GET",
      `/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=open`,
      PullList,
    );
    return open ? { prUrl: open.html_url, prNumber: open.number, alreadyExisted: true } : null;
  };

  const existing = await findOpenPr();
  if (existing) return existing;

  if (await branchExists(config, branch)) {
    throw new GithubError(
      `Branch ${branch} already exists without an open pull request. ` +
        `Delete that branch on GitHub, then upload again.`,
      CONFLICT,
    );
  }

  const base = await call(
    config,
    "GET",
    `/git/ref/heads/${encodeRef(config.baseBranch)}`,
    RefResponse,
  );
  const baseCommit = await call(config, "GET", `/git/commits/${base.object.sha}`, CommitResponse);

  const xlsxBlob = await call(config, "POST", "/git/blobs", Sha, {
    content: input.xlsx.toString("base64"),
    encoding: "base64",
  });
  const jsonBlob = await call(config, "POST", "/git/blobs", Sha, {
    content: input.catalogueJson,
    encoding: "utf-8",
  });
  const tree = await call(config, "POST", "/git/trees", Sha, {
    base_tree: baseCommit.tree.sha,
    tree: [
      { path: `pricelists/${input.filename}`, mode: "100644", type: "blob", sha: xlsxBlob.sha },
      { path: CATALOGUE_PATH, mode: "100644", type: "blob", sha: jsonBlob.sha },
    ],
  });
  const commit = await call(config, "POST", "/git/commits", Sha, {
    message: `${title}\n\nUploaded through the admin price list page.`,
    tree: tree.sha,
    parents: [base.object.sha],
  });

  const header = [
    `Automated upload of the **${input.filename}** price list.`,
    "",
    `- Price list date: ${input.priceListDate} (replaces ${input.currentPriceListDate})`,
    `- Changes: ${input.diffSummary}`,
    "",
    `Review the \`${CATALOGUE_PATH}\` diff and CI, then merge to deploy.`,
    "",
  ].join("\n");

  try {
    await call(config, "POST", "/git/refs", z.unknown(), {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
    const pr = await call(config, "POST", "/pulls", PullResponse, {
      title,
      head: branch,
      base: config.baseBranch,
      body: truncateBody(`${header}\n${input.bodyDetails}`),
    });
    return { prUrl: pr.html_url, prNumber: pr.number, alreadyExisted: false };
  } catch (error: unknown) {
    // A concurrent submit may have created the branch or PR between our check and our write.
    // GitHub answers that with 422, so look again and hand back the PR that won.
    if (error instanceof GithubError && error.status === UNPROCESSABLE) {
      const winner = await findOpenPr();
      if (winner) return winner;
    }
    throw error;
  }
}
