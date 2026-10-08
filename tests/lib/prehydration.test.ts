import { describe, expect, it } from "vitest";
import { typedBeforeHydration } from "../../src/lib/prehydration";

describe("typedBeforeHydration", () => {
  it("returns nothing when every DOM value matches state (deep link, no early typing)", () => {
    expect(typedBeforeHydration({ sp: "10", sh: "0.00" }, { sp: "10", sh: "0.00" })).toEqual({});
  });

  it("returns each field whose DOM value differs from state", () => {
    expect(
      typedBeforeHydration(
        { sp: "", sh: "0.00", pk: "0.00" },
        { sp: "9999.00", sh: "3.50", pk: "0.00" },
      ),
    ).toEqual({ sp: "9999.00", sh: "3.50" });
  });

  it("adopts an emptied field, so a cleared price beats the stale URL value", () => {
    expect(typedBeforeHydration({ sp: "10" }, { sp: "" })).toEqual({ sp: "" });
  });

  it("skips fields with no DOM node (conditionally rendered inputs)", () => {
    expect(typedBeforeHydration({ ad: "0.00", sp: "" }, { ad: undefined, sp: "5" })).toEqual({
      sp: "5",
    });
  });

  it("passes the typed string through untouched (money stays a string)", () => {
    expect(typedBeforeHydration({ sp: "" }, { sp: " 12.50 " })).toEqual({ sp: " 12.50 " });
  });
});
