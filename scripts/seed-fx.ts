import { writeFileSync } from "node:fs";
import path from "node:path";
import { fetchFrankfurterSnapshot } from "../src/fx/providers/frankfurter";
import { FxRawSnapshot } from "../src/lib/schemas";

async function main(): Promise<void> {
  const live = await fetchFrankfurterSnapshot();
  const seed = FxRawSnapshot.parse({ ...live, provider: "seed" });
  const outPath = path.join(process.cwd(), "src/data/fx-seed.json");
  writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(`Wrote ${outPath}: ${seed.rates.GBP} GBP, ${seed.rates.AUD} AUD, as of ${seed.asOf}`);
}

main().catch((error: unknown) => {
  console.error("seed-fx failed:", error);
  process.exit(1);
});
