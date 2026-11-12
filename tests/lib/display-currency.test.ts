import { describe, expect, it } from "vitest";
import { formatMoney, toDisplay } from "../../src/lib/display-currency";

const rates = { AUD: 1.5, HKD: 7.8 };

describe("toDisplay", () => {
  it("leaves AUD amounts unchanged, normalised to 2 decimals", () => {
    expect(toDisplay("2499", rates, "AUD")).toBe("2499.00");
  });

  it("converts AUD to USD by dividing by the USD→AUD rate", () => {
    expect(toDisplay("150.00", rates, "USD")).toBe("100.00");
  });

  it("converts AUD to HKD through USD", () => {
    expect(toDisplay("150.00", rates, "HKD")).toBe("780.00");
  });

  it("keeps the sign of negative amounts", () => {
    expect(toDisplay("-15.00", rates, "USD")).toBe("-10.00");
  });

  it("rounds half away from zero at 2 decimals", () => {
    expect(toDisplay("1.00", { AUD: 3 }, "USD")).toBe("0.33");
    expect(toDisplay("0.01", { AUD: 0.4 }, "USD")).toBe("0.03");
  });

  it("returns null for HKD when no HKD rate is available", () => {
    expect(toDisplay("150.00", { AUD: 1.5 }, "HKD")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("prefixes the currency symbol and groups thousands", () => {
    expect(formatMoney("2499.00", "AUD")).toBe("A$2,499.00");
    expect(formatMoney("1234567.5", "HKD")).toBe("HK$1,234,567.50");
    expect(formatMoney("10", "USD")).toBe("US$10.00");
  });

  it("puts the minus sign ahead of the symbol", () => {
    expect(formatMoney("-12.30", "AUD")).toBe("−A$12.30");
  });
});
