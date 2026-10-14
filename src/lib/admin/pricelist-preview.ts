import { inspectXlsxZip } from "./zip-guard";
import {
  buildCatalogueFromXlsx,
  clip,
  diffCatalogues,
  type BuildResult,
  type CatalogueDiff,
} from "../catalogue-build";

export const LARGE_CHANGE_PCT_THRESHOLD = 20;

type CatalogueType = BuildResult["catalogue"];
type Repriced = CatalogueDiff["repriced"][number];

export type PreviewResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      currentPriceListDate: string;
      newPriceListDate: string;
      checksum: string;
      diff: CatalogueDiff;
      warnings: string[];
      largeChanges: Repriced[];
    };

export type PreviewOptions = { allowOlder?: boolean };

const MAX_ERROR_CHARS = 600;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? clip(error.message, MAX_ERROR_CHARS)
    : "Could not read the workbook.";
}

/** Builds the catalogue from an upload and diffs it against the current one. No side effects. */
export async function previewPricelist(
  buffer: Buffer,
  filename: string,
  current: CatalogueType,
  options: PreviewOptions = {},
): Promise<PreviewResult> {
  const zipErrors = inspectXlsxZip(buffer);
  if (zipErrors.length > 0) return { ok: false, errors: zipErrors };

  let built: BuildResult;
  try {
    built = await buildCatalogueFromXlsx(buffer, filename);
  } catch (error: unknown) {
    return { ok: false, errors: [errorMessage(error)] };
  }

  const { catalogue, warnings } = built;
  if (!options.allowOlder && catalogue.priceListDate <= current.priceListDate) {
    return {
      ok: false,
      errors: [
        `Price list date ${catalogue.priceListDate} is not newer than the current ${current.priceListDate}. ` +
          `Tick "allow an older or same-date price list" if this is intentional.`,
      ],
    };
  }

  const diff = diffCatalogues(current.items, catalogue.items);
  return {
    ok: true,
    currentPriceListDate: current.priceListDate,
    newPriceListDate: catalogue.priceListDate,
    checksum: catalogue.checksum,
    diff,
    warnings,
    largeChanges: diff.repriced.filter((r) => Math.abs(r.pctChange) >= LARGE_CHANGE_PCT_THRESHOLD),
  };
}
