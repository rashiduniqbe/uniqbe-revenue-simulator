export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { serializeCatalogue } from "../../../../../lib/catalogue-build";
import { CURRENT_CATALOGUE } from "../../../../../lib/admin/current-catalogue";
import {
  GithubError,
  createPricelistPr,
  readGithubConfig,
} from "../../../../../lib/admin/github-pr";

const CONFLICT = 409;
import { requireAdminSession } from "../../../../../lib/admin/guard";
import { formatPrDetails, summarizeDiff } from "../../../../../lib/admin/pr-body";
import { previewPricelist } from "../../../../../lib/admin/pricelist-preview";
import { failure, readPricelistUpload } from "../../../../../lib/admin/read-upload";

export async function POST(request: Request): Promise<Response> {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const github = readGithubConfig();
  if (!github) {
    console.error("pricelist publish: GITHUB_PRICELIST_TOKEN or GITHUB_REPO is missing or invalid");
    return failure(["Publishing is not configured on this deployment."], 503);
  }

  const upload = await readPricelistUpload(request);
  if (!upload.ok) return upload.response;

  // The upload is validated again from scratch: nothing the preview said is trusted.
  const result = await previewPricelist(upload.buffer, upload.file.name, CURRENT_CATALOGUE, {
    allowOlder: upload.allowOlder,
  });
  if (!result.ok) return failure(result.errors, 400);

  try {
    const pr = await createPricelistPr(
      {
        filename: upload.file.name,
        xlsx: upload.buffer,
        catalogueJson: serializeCatalogue(result.catalogue),
        priceListDate: result.newPriceListDate,
        currentPriceListDate: result.currentPriceListDate,
        diffSummary: summarizeDiff(result.diff),
        bodyDetails: formatPrDetails(result),
      },
      github,
    );
    return NextResponse.json({ ok: true, ...pr });
  } catch (error: unknown) {
    // A leftover branch is an operator-fixable condition, and the message names only the branch.
    if (error instanceof GithubError && error.status === CONFLICT) {
      return failure([error.message], CONFLICT);
    }
    console.error("pricelist publish: pull request creation failed", {
      status: error instanceof Error && "status" in error ? error.status : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    return failure(["Could not create the pull request. Check the server logs."], 502);
  }
}
