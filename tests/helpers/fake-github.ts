// A tiny in-memory stand-in for the GitHub REST endpoints the price-list PR flow uses.
export type FakeGithubOptions = {
  repo: string;
  baseBranch?: string;
  existingBranches?: string[];
  existingPr?: { html_url: string; number: number };
  failOn?: string; // "METHOD /path-substring" that returns a 500
  createdPrUrl?: string; // html_url returned for a newly created PR
  // Simulates a concurrent request that opens the PR between our check and our create:
  // the first PR list is empty, the create answers 422, and later lists contain this PR.
  racePr?: { html_url: string; number: number };
};

export type FakeCall = {
  method: string;
  url: string;
  headers: Headers;
  body: unknown;
  redirect?: RequestRedirect;
  hasSignal: boolean;
};

const BASE_SHA = "base-commit-sha";
const BASE_TREE = "base-tree-sha";

export function createFakeGithub(options: FakeGithubOptions) {
  const baseBranch = options.baseBranch ?? "main";
  const branches = new Set(options.existingBranches ?? []);
  const calls: FakeCall[] = [];
  let raced = false;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

  const fetchFake: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : (input as Request).url);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({
      method,
      url: url.toString(),
      headers,
      body,
      redirect: init?.redirect,
      hasSignal: init?.signal instanceof AbortSignal,
    });

    if (url.origin !== "https://api.github.com") return json({ message: "unexpected host" }, 599);
    const path = url.pathname.replace(`/repos/${options.repo}`, "");
    if (options.failOn && `${method} ${path}`.includes(options.failOn)) {
      return json({ message: "boom" }, 500);
    }

    if (method === "GET" && path === `/git/ref/heads/${baseBranch}`) {
      return json({ object: { sha: BASE_SHA } });
    }
    if (method === "GET" && path.startsWith("/git/ref/heads/")) {
      const branch = decodeURIComponent(path.replace("/git/ref/heads/", ""));
      return branches.has(branch) ? json({ object: { sha: "old-branch-sha" } }) : json({}, 404);
    }
    if (method === "GET" && path === `/git/commits/${BASE_SHA}`) {
      return json({ tree: { sha: BASE_TREE } });
    }
    if (method === "GET" && path === "/pulls") {
      if (options.racePr) return json(raced ? [options.racePr] : []);
      return json(options.existingPr ? [options.existingPr] : []);
    }
    if (method === "POST" && path === "/git/blobs") return json({ sha: `blob-${calls.length}` });
    if (method === "POST" && path === "/git/trees") return json({ sha: "new-tree-sha" });
    if (method === "POST" && path === "/git/commits") return json({ sha: "new-commit-sha" });
    if (method === "POST" && path === "/git/refs") {
      branches.add(String((body as { ref: string }).ref).replace("refs/heads/", ""));
      return json({}, 201);
    }
    if (method === "PATCH" && path.startsWith("/git/refs/heads/")) return json({});
    if (method === "POST" && path === "/pulls") {
      if (options.racePr) {
        raced = true;
        return json({ message: "A pull request already exists" }, 422);
      }
      return json(
        {
          html_url: options.createdPrUrl ?? "https://github.com/example-owner/example-repo/pull/42",
          number: 42,
        },
        201,
      );
    }
    return json({ message: `unhandled ${method} ${path}` }, 404);
  };

  return {
    fetch: fetchFake,
    calls,
    constants: { BASE_SHA, BASE_TREE },
    callsMatching: (method: string, pathPart: string) =>
      calls.filter((c) => c.method === method && new URL(c.url).pathname.includes(pathPart)),
  };
}
