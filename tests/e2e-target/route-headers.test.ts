import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeWithTargetHeaders } from "../../e2e/route-headers";
import { resolveE2ETarget } from "../../e2e/target";

const SECRET = "s3cret";

type Seen = { path: string; headers: IncomingHttpHeaders };

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

// Two origins on 127.0.0.1 (different ports): the target, which redirects
// /away to the other origin, and a third party that records what it receives.
describe("routeWithTargetHeaders (real browser)", () => {
  const targetSeen: Seen[] = [];
  const thirdSeen: Seen[] = [];
  let targetOrigin = "";
  let thirdOrigin = "";
  let browser: Browser;
  const targetServer = createServer((req, res) => {
    targetSeen.push({ path: req.url ?? "", headers: req.headers });
    if (req.url === "/away") {
      res.writeHead(302, { location: `${thirdOrigin}/landing` }).end();
      return;
    }
    if (req.url === "/home") {
      // Stands in for Vercel answering x-vercel-set-bypass-cookie with its bypass cookie.
      res.writeHead(302, { location: "/page", "set-cookie": "bypass=1; Path=/" }).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end("<p>target</p>");
  });
  const thirdServer = createServer((req, res) => {
    thirdSeen.push({ path: req.url ?? "", headers: req.headers });
    res.writeHead(200, { "content-type": "text/html" }).end("<p>third party</p>");
  });

  beforeAll(async () => {
    targetOrigin = await listen(targetServer);
    thirdOrigin = await listen(thirdServer);
    browser = await chromium.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    targetServer.close();
    thirdServer.close();
  });

  async function visit(path: string): Promise<string> {
    const target = resolveE2ETarget({
      PLAYWRIGHT_BASE_URL: targetOrigin,
      VERCEL_AUTOMATION_BYPASS_SECRET: SECRET,
    });
    const context = await browser.newContext();
    try {
      await context.route("**/*", (route) => routeWithTargetHeaders(route, target));
      const page = await context.newPage();
      await page.goto(`${targetOrigin}${path}`);
      return page.url();
    } finally {
      await context.close();
    }
  }

  it("never sends the bypass secret across a cross-origin redirect", async () => {
    const landed = await visit("/away");
    expect(landed).toBe(`${thirdOrigin}/landing`);
    expect(targetSeen.find((s) => s.path === "/away")?.headers["x-vercel-protection-bypass"]).toBe(
      SECRET,
    );
    const landing = thirdSeen.find((s) => s.path === "/landing");
    expect(landing).toBeDefined();
    expect(landing?.headers["x-vercel-protection-bypass"]).toBeUndefined();
  }, 30_000);

  // Playwright never routes a followed redirect hop, so a same-origin hop is
  // authenticated by the bypass cookie the first response set, not by headers.
  it("keeps the bypass cookie from the first response on a same-origin redirect hop", async () => {
    const landed = await visit("/home");
    expect(landed).toBe(`${targetOrigin}/page`);
    expect(targetSeen.find((s) => s.path === "/page")?.headers.cookie).toBe("bypass=1");
  }, 30_000);
});
