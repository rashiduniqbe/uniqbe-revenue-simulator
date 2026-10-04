import { describe, expect, it } from "vitest";
import { LOCAL_PORT, resolveE2ETarget } from "../../e2e/target";

describe("resolveE2ETarget", () => {
  it("defaults to the local production build on port 3100", () => {
    expect(resolveE2ETarget({})).toEqual({
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      extraHTTPHeaders: {},
      trace: "retain-on-failure",
    });
    expect(LOCAL_PORT).toBe(3100);
  });

  it("treats a blank PLAYWRIGHT_BASE_URL as unset", () => {
    expect(resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "   " }).startLocalServer).toBe(true);
  });

  it("targets a deployment without starting a server, trailing slash removed", () => {
    const target = resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "https://x-git-pr-3.vercel.app/" });
    expect(target.baseURL).toBe("https://x-git-pr-3.vercel.app");
    expect(target.startLocalServer).toBe(false);
    expect(target.extraHTTPHeaders).toEqual({ "x-vercel-skip-toolbar": "1" });
  });

  it("never records traces against a deployment, since they would capture the bypass header", () => {
    const target = resolveE2ETarget({
      PLAYWRIGHT_BASE_URL: "https://x.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret",
    });
    expect(target.trace).toBe("off");
  });

  it("sends Vercel's automation-bypass headers when the secret is set", () => {
    const target = resolveE2ETarget({
      PLAYWRIGHT_BASE_URL: "https://x.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: " s3cret ",
    });
    expect(target.extraHTTPHeaders).toEqual({
      "x-vercel-skip-toolbar": "1",
      "x-vercel-protection-bypass": "s3cret",
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  it("fails fast on a base URL that isn't http(s)", () => {
    expect(() => resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "x.vercel.app" })).toThrow(
      /PLAYWRIGHT_BASE_URL must start with http:\/\/ or https:\/\//,
    );
  });

  it("in strict mode, refuses a blank URL instead of falling back to localhost", () => {
    expect(() =>
      resolveE2ETarget({ E2E_REQUIRE_DEPLOYMENT: "1", PLAYWRIGHT_BASE_URL: " " }),
    ).toThrow(/E2E_REQUIRE_DEPLOYMENT is set but PLAYWRIGHT_BASE_URL is empty/);
  });

  it("in strict mode, refuses a deployment without the bypass secret", () => {
    expect(() =>
      resolveE2ETarget({
        E2E_REQUIRE_DEPLOYMENT: "1",
        PLAYWRIGHT_BASE_URL: "https://x.vercel.app",
      }),
    ).toThrow(/VERCEL_AUTOMATION_BYPASS_SECRET is empty/);
  });

  it("in strict mode, accepts a deployment URL with the bypass secret", () => {
    const target = resolveE2ETarget({
      E2E_REQUIRE_DEPLOYMENT: "1",
      PLAYWRIGHT_BASE_URL: "https://x.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret",
    });
    expect(target.startLocalServer).toBe(false);
  });
});
