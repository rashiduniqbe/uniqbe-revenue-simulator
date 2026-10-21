import { buildCatalogue, type BuildResult } from "./core";
import { readWorkbookBuffer } from "./workbook";

export * from "./core";
export * from "./diff";
export { readWorkbookBuffer, readWorkbookFile } from "./workbook";

/** Pure build entry point: an xlsx buffer and its filename in, a validated catalogue out. */
export async function buildCatalogueFromXlsx(
  buffer: Buffer,
  sourceFile: string,
): Promise<BuildResult> {
  const rows = await readWorkbookBuffer(buffer, sourceFile);
  return buildCatalogue(rows, sourceFile);
}
