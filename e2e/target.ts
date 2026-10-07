export const LOCAL_PORT = 3100;

export type E2ETarget = {
  baseURL: string;
  startLocalServer: boolean;
  // Sent only on requests to baseURL's origin (see headersForRequest), so the
  // bypass secret never reaches a third-party host.
  targetHeaders: Record<string, string>;
  trace: "retain-on-failure" | "off";
};

type Env = Record<string, string | undefined>;

// Spec §12.1: E2E runs against the local production build by default, or
// against a deployed Vercel preview when PLAYWRIGHT_BASE_URL is set.
// Previews sit behind Vercel Authentication, so CI passes the
// "Protection Bypass for Automation" secret as a header.
// E2E_REQUIRE_DEPLOYMENT (set by the preview workflow) turns a missing URL or
// secret into an error, so that job can never go green against localhost or
// fail on Vercel's login wall.
export function resolveE2ETarget(env: Env): E2ETarget {
  const external = env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
  const requireDeployment = (env.E2E_REQUIRE_DEPLOYMENT?.trim() ?? "") !== "";
  if (external === "") {
    if (requireDeployment) {
      throw new Error("E2E_REQUIRE_DEPLOYMENT is set but PLAYWRIGHT_BASE_URL is empty");
    }
    return {
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      targetHeaders: {},
      trace: "retain-on-failure",
    };
  }
  const baseURL = parseOrigin(external);
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";
  if (bypass === "" && requireDeployment) {
    throw new Error("E2E_REQUIRE_DEPLOYMENT is set but VERCEL_AUTOMATION_BYPASS_SECRET is empty");
  }
  return {
    baseURL,
    startLocalServer: false,
    // The Vercel Toolbar on previews would add markup the a11y specs don't own.
    targetHeaders: {
      "x-vercel-skip-toolbar": "1",
      ...(bypass === ""
        ? {}
        : { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }),
    },
    // Traces record request headers, so they would carry the bypass secret.
    trace: "off",
  };
}

function parseOrigin(raw: string): string {
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(`PLAYWRIGHT_BASE_URL must start with http:// or https:// (got "${raw}")`);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`PLAYWRIGHT_BASE_URL is not a valid URL (got "${raw}")`);
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(
      `PLAYWRIGHT_BASE_URL must be an origin with no path, query or hash (got "${raw}")`,
    );
  }
  return url.origin;
}

// The headers a single request should carry: the target headers for the
// target's own origin, nothing for anything else.
export function headersForRequest(requestUrl: string, target: E2ETarget): Record<string, string> {
  if (target.startLocalServer) return {};
  let origin: string;
  try {
    origin = new URL(requestUrl).origin;
  } catch {
    return {};
  }
  return origin === target.baseURL ? target.targetHeaders : {};
}

// True when the suite targets a deployment. Specs that need the local build
// (fake analytics host, no Redis) skip themselves on this. It is a function,
// not a constant, so importing this module never reads the environment.
export function isAgainstDeployment(env: Env = process.env): boolean {
  return !resolveE2ETarget(env).startLocalServer;
}
