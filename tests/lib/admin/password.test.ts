import { describe, expect, it } from "vitest";
import { passwordMatches } from "../../../src/lib/admin/password";

describe("passwordMatches", () => {
  it("accepts the exact password", async () => {
    expect(await passwordMatches("correct horse", "correct horse")).toBe(true);
  });

  it("rejects a wrong password, including one that is a prefix or longer", async () => {
    expect(await passwordMatches("wrong", "correct horse")).toBe(false);
    expect(await passwordMatches("correct", "correct horse")).toBe(false);
    expect(await passwordMatches("correct horse!", "correct horse")).toBe(false);
  });

  it("is case sensitive", async () => {
    expect(await passwordMatches("Correct Horse", "correct horse")).toBe(false);
  });

  it("rejects everything when no password is configured", async () => {
    expect(await passwordMatches("", "")).toBe(false);
    expect(await passwordMatches("anything", undefined)).toBe(false);
    expect(await passwordMatches("", undefined)).toBe(false);
  });
});
