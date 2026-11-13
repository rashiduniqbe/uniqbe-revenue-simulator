import { describe, expect, it } from "vitest";
import { convertAmount, formatMoney, toAud, toDisplay } from "../../src/lib/display-currency";

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

describe("toAud", () => {
  it("leaves AUD amounts as they are", () => {
    expect(toAud("12.5", rates, "AUD")).toBe("12.5");
  });

  it("converts USD to AUD by multiplying by the USD→AUD rate", () => {
    expect(toAud("100", rates, "USD")).toBe("150");
  });

  it("converts HKD to AUD through USD", () => {
    expect(toAud("780", rates, "HKD")).toBe("150");
  });

  it("returns plain decimal text, never exponent notation", () => {
    expect(toAud("0.0000001", rates, "USD")).toBe("0");
    expect(toAud("1", { AUD: 1.395 }, "USD")).toBe("1.395");
  });

  it("returns null for HKD when no HKD rate is available", () => {
    expect(toAud("10", { AUD: 1.5 }, "HKD")).toBeNull();
  });

  it("round-trips through toDisplay", () => {
    const aud = toAud("1791.40", { AUD: 1.395, HKD: 7.838 }, "USD") ?? "";
    expect(toDisplay(aud, { AUD: 1.395, HKD: 7.838 }, "USD")).toBe("1791.40");
  });
});

describe("convertAmount", () => {
  it("re-expresses a typed amount in another currency at 2 dp", () => {
    expect(convertAmount("100", rates, "USD", "AUD")).toBe("150.00");
    expect(convertAmount("150", rates, "AUD", "HKD")).toBe("780.00");
  });

  it("leaves blank or malformed text unchanged", () => {
    expect(convertAmount("", rates, "USD", "AUD")).toBe("");
    expect(convertAmount("12abc", rates, "USD", "AUD")).toBe("12abc");
  });

  it("leaves the amount unchanged when a rate is missing", () => {
    expect(convertAmount("10", { AUD: 1.5 }, "USD", "HKD")).toBe("10");
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

describe("toDisplay rounding up", () => {
  it("rounds a converted amount up to the next cent when asked", () => {
    // 100 AUD / 1.5 = 66.666… USD
    expect(toDisplay("100", { AUD: 1.5 }, "USD")).toBe("66.67");
    expect(toDisplay("100.01", { AUD: 1.5 }, "USD", "up")).toBe("66.68");
    expect(toDisplay("99.99", { AUD: 1.5 }, "USD", "up")).toBe("66.66");
  });

  it("leaves an exact cent alone", () => {
    expect(toDisplay("150", { AUD: 1.5 }, "USD", "up")).toBe("100.00");
  });
});
