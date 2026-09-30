import { describe, expect, it } from "vitest";
import { isValidDecimalString } from "../../src/lib/decimal-validation";

describe("isValidDecimalString", () => {
  it.each(["0", "12.50", "-3.2"])("accepts %s", (value) => {
    expect(isValidDecimalString(value)).toBe(true);
  });

  it.each(["", " ", "abc", "1,200", "."])("rejects %s", (value) => {
    expect(isValidDecimalString(value)).toBe(false);
  });
});
