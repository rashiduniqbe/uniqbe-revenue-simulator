import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const specs = readdirSync("e2e").filter((f) => f.endsWith(".spec.ts"));

describe("every E2E spec uses the target-header fixture", () => {
  it("finds the spec files", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  it.each(specs)("%s imports test from ./fixtures, not @playwright/test", (file) => {
    const src = readFileSync(`e2e/${file}`, "utf-8");
    expect(src).toMatch(/import \{[^}]*\btest\b[^}]*\} from "\.\/fixtures";/);
    expect(src).not.toMatch(/import \{[^}]*\btest\b[^}]*\} from "@playwright\/test";/);
  });
});
