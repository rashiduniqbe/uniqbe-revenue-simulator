import { describe, expect, it } from "vitest";
import { computeOtherFees } from "../../../src/engine/platforms/other";

describe("computeOtherFees", () => {
  it("always returns zero fees", () => {
    expect(computeOtherFees()).toEqual({});
  });
});
