export const LOCAL_PORT = 3100;

export type E2ETarget = {
  baseURL: string;
  startLocalServer: boolean;
  extraHTTPHeaders: Record<string, string>;
  trace: "retain-on-failure" | "off";
};

// Spec §12.1: E2E runs against the local production build by default, or
// against a deployed Vercel preview when PLAYWRIGHT_BASE_URL is set.
// Previews sit behind Vercel Authentication, so CI passes the
// "Protection Bypass for Automation" secret as a header.
// E2E_REQUIRE_DEPLOYMENT (set by the preview workflow) turns a missing URL or
// secret into an error, so that job can never go green against localhost or
// fail on Vercel's login wall.
export function resolveE2ETarget(env: Record<string, string | undefined>): E2ETarget {
  const external = env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
  const requireDeployment = (env.E2E_REQUIRE_DEPLOYMENT?.trim() ?? "") !== "";
  if (external === "") {
    if (requireDeployment) {
      throw new Error("E2E_REQUIRE_DEPLOYMENT is set but PLAYWRIGHT_BASE_URL is empty");
    }
    return {
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      extraHTTPHeaders: {},
      trace: "retain-on-failure",
    };
  }
  if (!/^https?:\/\//i.test(external)) {
    throw new Error(`PLAYWRIGHT_BASE_URL must start with http:// or https:// (got "${external}")`);
  }
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";
  if (bypass === "" && requireDeployment) {
    throw new Error("E2E_REQUIRE_DEPLOYMENT is set but VERCEL_AUTOMATION_BYPASS_SECRET is empty");
  }
  return {
    baseURL: external.replace(/\/+$/, ""),
    startLocalServer: false,
    // The Vercel Toolbar on previews would add markup the a11y specs don't own.
    extraHTTPHeaders: {
      "x-vercel-skip-toolbar": "1",
      ...(bypass === ""
        ? {}
        : { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }),
    },
    // Traces record request headers, so they would carry the bypass secret.
    trace: "off",
  };
}

// True when the suite targets a deployment. Specs that need the local build
// (fake analytics host, no Redis) skip themselves on this flag.
export const AGAINST_DEPLOYMENT = !resolveE2ETarget(process.env).startLocalServer;
