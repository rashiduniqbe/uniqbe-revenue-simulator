import { describe, expect, it } from "vitest";
import { diffCatalogues } from "../../src/lib/catalogue-build";
import * as cliDiff from "../../scripts/catalogue-diff";

describe("diffCatalogues shared module", () => {
  it("is the same function the CLI exports", () => {
    expect(cliDiff.diffCatalogues).toBe(diffCatalogues);
  });

  it("reports no changes for empty catalogues", () => {
    expect(diffCatalogues([], [])).toEqual({ added: [], removed: [], repriced: [] });
  });
});
