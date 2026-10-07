import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_PORT,
  headersForRequest,
  isAgainstDeployment,
  resolveE2ETarget,
} from "../../e2e/target";

const DEPLOY = "https://x.vercel.app";

describe("resolveE2ETarget", () => {
  it("defaults to the local production build on port 3100", () => {
    expect(resolveE2ETarget({})).toEqual({
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      targetHeaders: {},
      trace: "retain-on-failure",
    });
    expect(LOCAL_PORT).toBe(3100);
  });

  it("treats a blank PLAYWRIGHT_BASE_URL as unset", () => {
    expect(resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "   " }).startLocalServer).toBe(true);
  });

  it("targets a deployment origin without starting a server, trailing slash removed", () => {
    const target = resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "https://x-git-pr-3.vercel.app/" });
    expect(target.baseURL).toBe("https://x-git-pr-3.vercel.app");
    expect(target.startLocalServer).toBe(false);
    expect(target.targetHeaders).toEqual({ "x-vercel-skip-toolbar": "1" });
  });

  it("normalises scheme and host case to a canonical origin", () => {
    expect(resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "HTTPS://X.Vercel.App" }).baseURL).toBe(DEPLOY);
  });

  it("never records traces against a deployment, since they would capture the bypass header", () => {
    expect(resolveE2ETarget({ PLAYWRIGHT_BASE_URL: DEPLOY }).trace).toBe("off");
  });

  it("adds Vercel's automation-bypass headers to the target headers when the secret is set", () => {
    const target = resolveE2ETarget({
      PLAYWRIGHT_BASE_URL: DEPLOY,
      VERCEL_AUTOMATION_BYPASS_SECRET: " s3cret ",
    });
    expect(target.targetHeaders).toEqual({
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

  it("rejects a URL with no host", () => {
    expect(() => resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "https://" })).toThrow(
      /PLAYWRIGHT_BASE_URL is not a valid URL/,
    );
  });

  it("rejects a URL with a path, query or hash", () => {
    for (const bad of [`${DEPLOY}/compare`, `${DEPLOY}/?p=AM1`, `${DEPLOY}/#top`]) {
      expect(() => resolveE2ETarget({ PLAYWRIGHT_BASE_URL: bad })).toThrow(
        /PLAYWRIGHT_BASE_URL must be an origin with no path, query or hash/,
      );
    }
  });

  it("in strict mode, refuses a blank URL instead of falling back to localhost", () => {
    expect(() =>
      resolveE2ETarget({ E2E_REQUIRE_DEPLOYMENT: "1", PLAYWRIGHT_BASE_URL: " " }),
    ).toThrow(/E2E_REQUIRE_DEPLOYMENT is set but PLAYWRIGHT_BASE_URL is empty/);
  });

  it("in strict mode, refuses a deployment without the bypass secret", () => {
    expect(() =>
      resolveE2ETarget({ E2E_REQUIRE_DEPLOYMENT: "1", PLAYWRIGHT_BASE_URL: DEPLOY }),
    ).toThrow(/VERCEL_AUTOMATION_BYPASS_SECRET is empty/);
  });

  it("in strict mode, accepts a deployment URL with the bypass secret", () => {
    const target = resolveE2ETarget({
      E2E_REQUIRE_DEPLOYMENT: "1",
      PLAYWRIGHT_BASE_URL: DEPLOY,
      VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret",
    });
    expect(target.startLocalServer).toBe(false);
  });
});

describe("headersForRequest", () => {
  const target = resolveE2ETarget({
    PLAYWRIGHT_BASE_URL: DEPLOY,
    VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret",
  });

  it("sends the target headers to the target origin, any path", () => {
    expect(headersForRequest(`${DEPLOY}/compare?p=AM1`, target)).toEqual(target.targetHeaders);
  });

  it("sends nothing to other origins", () => {
    expect(headersForRequest("https://eu.i.posthog.com/e/", target)).toEqual({});
    expect(headersForRequest("https://fonts.gstatic.com/s/x.woff2", target)).toEqual({});
  });

  it("sends nothing to the same host on a different scheme or port", () => {
    expect(headersForRequest("http://x.vercel.app/", target)).toEqual({});
    expect(headersForRequest("https://x.vercel.app:8443/", target)).toEqual({});
  });

  it("sends nothing for unparseable or opaque URLs", () => {
    expect(headersForRequest("not a url", target)).toEqual({});
    expect(headersForRequest("data:text/plain,hi", target)).toEqual({});
  });

  it("sends nothing on local runs", () => {
    expect(headersForRequest(`http://localhost:${LOCAL_PORT}/`, resolveE2ETarget({}))).toEqual({});
  });
});

describe("isAgainstDeployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false for local runs and true for deployment runs", () => {
    expect(isAgainstDeployment({})).toBe(false);
    expect(isAgainstDeployment({ PLAYWRIGHT_BASE_URL: DEPLOY })).toBe(true);
  });

  it("importing the module never reads the environment", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "not-a-url");
    vi.resetModules();
    await expect(import("../../e2e/target")).resolves.toHaveProperty("isAgainstDeployment");
  });
});
