export const LOCAL_PORT = 3100;

export type E2ETarget = {
  baseURL: string;
  startLocalServer: boolean;
  extraHTTPHeaders: Record<string, string>;
};

// Spec §12.1: E2E runs against the local production build by default, or
// against a deployed Vercel preview when PLAYWRIGHT_BASE_URL is set.
// Previews sit behind Vercel Authentication, so CI passes the
// "Protection Bypass for Automation" secret as a header.
export function resolveE2ETarget(env: Record<string, string | undefined>): E2ETarget {
  const external = env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
  if (external === "") {
    return {
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      extraHTTPHeaders: {},
    };
  }
  if (!/^https?:\/\//i.test(external)) {
    throw new Error(`PLAYWRIGHT_BASE_URL must start with http:// or https:// (got "${external}")`);
  }
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";
  return {
    baseURL: external.replace(/\/+$/, ""),
    startLocalServer: false,
    extraHTTPHeaders:
      bypass === ""
        ? {}
        : { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
  };
}

// True when the suite targets a deployment. Specs that need the local build
// (fake analytics host, no Redis) skip themselves on this flag.
export const AGAINST_DEPLOYMENT = !resolveE2ETarget(process.env).startLocalServer;
