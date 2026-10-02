import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
  regions?: string[];
  crons?: { path: string; schedule: string }[];
};

const vercel = JSON.parse(readFileSync("vercel.json", "utf-8")) as VercelConfig;
const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { engines?: { node?: string } };

describe("vercel.json matches spec §12.2", () => {
  it("uses the Next.js preset with the spec's install and build commands", () => {
    expect(vercel.framework).toBe("nextjs");
    expect(vercel.installCommand).toBe("pnpm install --frozen-lockfile");
    expect(vercel.buildCommand).toBe("pnpm build");
  });

  it("runs functions in London only (lhr1)", () => {
    expect(vercel.regions).toEqual(["lhr1"]);
  });

  it("schedules exactly one cron: the daily FX refresh at 06:00 UTC", () => {
    expect(vercel.crons).toEqual([{ path: "/api/cron/fx-refresh", schedule: "0 6 * * *" }]);
  });

  it("pins Node 22.x via package.json engines (Vercel reads this)", () => {
    expect(pkg.engines?.node).toBe("22.x");
  });
});
