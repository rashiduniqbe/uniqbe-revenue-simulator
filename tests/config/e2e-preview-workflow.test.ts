import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wf = readFileSync(".github/workflows/e2e-preview.yml", "utf-8");

describe("e2e-preview.yml keeps the bypass secret safe (public repo)", () => {
  it("runs E2E in strict deployment mode", () => {
    expect(wf).toMatch(/E2E_REQUIRE_DEPLOYMENT:\s*"1"/);
  });

  it("uploads no artifact, since a Playwright report could carry the bypass header", () => {
    expect(wf).not.toMatch(/upload-artifact/);
  });

  it("checks out without persisting the GitHub token", () => {
    expect(wf).toMatch(/persist-credentials:\s*false/);
  });

  it("reads the bypass secret only from repository secrets", () => {
    expect(wf).toMatch(
      /VERCEL_AUTOMATION_BYPASS_SECRET:\s*\$\{\{\s*secrets\.VERCEL_AUTOMATION_BYPASS_SECRET\s*\}\}/,
    );
  });

  it("only runs for successful Preview deployments", () => {
    expect(wf).toMatch(/deployment_status\.state == 'success'/);
    expect(wf).toMatch(/startsWith\(github\.event\.deployment_status\.environment, 'Preview'\)/);
  });
});
