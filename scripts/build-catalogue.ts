// scripts/build-catalogue.ts
// Thin CLI over the pure core in src/lib/catalogue-build/. The same core backs the admin upload.
import { readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildCatalogue as buildCatalogueCore,
  readWorkbookFile,
  serializeCatalogue,
  CATEGORY_MAP,
  type CategoryMap,
  type RawRow,
} from "../src/lib/catalogue-build";

export {
  CATEGORY_MAP,
  mapCategory,
  deriveStorageGb,
  buildSearchHaystack,
  computeChecksum,
  parsePriceListDate,
  type CategoryMap,
  type RawRow,
} from "../src/lib/catalogue-build";

export function buildCatalogue(
  rows: RawRow[],
  sourceFile: string,
  categoryMap: CategoryMap = CATEGORY_MAP,
) {
  const { catalogue, warnings } = buildCatalogueCore(rows, sourceFile, categoryMap);
  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  return catalogue;
}

export async function readWorkbook(path: string): Promise<{ rows: RawRow[]; sourceFile: string }> {
  const rows = await readWorkbookFile(path);
  return { rows, sourceFile: path.split(/[/\\]/).pop() ?? path };
}

function resolveInputPath(): string {
  const argPath = process.argv.find((a) => a.endsWith(".xlsx"));
  if (argPath) return argPath;
  const dir = "pricelists";
  const candidates = readdirSync(dir).filter((f) => f.endsWith(".xlsx"));
  if (candidates.length === 0) throw new Error(`No .xlsx files found in ./${dir}/`);
  const newest = candidates.sort().at(-1);
  if (!newest) throw new Error(`No .xlsx files found in ./${dir}/`);
  return join(dir, newest);
}

async function main() {
  const verify = process.argv.includes("--verify");
  const inputPath = resolveInputPath();
  const { rows, sourceFile } = await readWorkbook(inputPath);
  const catalogue = buildCatalogue(rows, sourceFile);
  const outputPath = "src/data/catalogue.json";

  if (verify) {
    if (!existsSync(outputPath)) {
      console.error(`✗ ${outputPath} does not exist.`);
      process.exit(1);
    }
    const committed = JSON.parse(readFileSync(outputPath, "utf-8"));
    if (committed.checksum !== catalogue.checksum) {
      console.error(
        `✗ Checksum mismatch: committed ${committed.checksum}, freshly built ${catalogue.checksum}.\n` +
          `  Run "pnpm catalogue:build" and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`✓ ${outputPath} matches ${inputPath} (checksum ${catalogue.checksum}).`);
    return;
  }

  writeFileSync(outputPath, serializeCatalogue(catalogue));
  console.log(
    `Wrote ${catalogue.items.length} products to ${outputPath} (checksum ${catalogue.checksum}).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
