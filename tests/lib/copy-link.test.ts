import { describe, expect, it, vi } from "vitest";
import { copyLink } from "../../src/lib/copy-link";

describe("copyLink", () => {
  it("writes the href and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyLink({ writeText }, "https://sim.uniqbe.com/?p=AB12345")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://sim.uniqbe.com/?p=AB12345");
  });

  it("reports failure when the clipboard API is missing (insecure context, old browser)", async () => {
    await expect(copyLink(undefined, "https://x")).resolves.toBe(false);
  });

  it("reports failure, without throwing, when the write is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await expect(copyLink({ writeText }, "https://x")).resolves.toBe(false);
  });
});
