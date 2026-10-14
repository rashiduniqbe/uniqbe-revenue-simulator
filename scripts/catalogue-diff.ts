import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { diffCatalogues } from "../src/lib/catalogue-build";

export { diffCatalogues, type CatalogueDiff } from "../src/lib/catalogue-build";

function main() {
  const [, , oldPath, newPath] = process.argv;
  if (!oldPath || !newPath) {
    console.error("Usage: pnpm catalogue:diff <old.json> <new.json>");
    process.exit(1);
  }
  const oldCatalogue = JSON.parse(readFileSync(oldPath, "utf-8"));
  const newCatalogue = JSON.parse(readFileSync(newPath, "utf-8"));
  const diff = diffCatalogues(oldCatalogue.items, newCatalogue.items);

  console.log(
    `${diff.added.length} added, ${diff.removed.length} removed, ${diff.repriced.length} repriced`,
  );
  for (const i of diff.added) console.log(`  + ${i.code} ${i.brand} ${i.name} ($${i.usd})`);
  for (const i of diff.removed) console.log(`  - ${i.code} ${i.brand} ${i.name}`);
  for (const r of diff.repriced) {
    const sign = r.pctChange >= 0 ? "+" : "";
    console.log(`  ~ ${r.code} $${r.oldUsd} -> $${r.newUsd} (${sign}${r.pctChange}%)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
