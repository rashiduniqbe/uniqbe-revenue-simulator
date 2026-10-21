# Price list upload (admin)

The monthly reseller price list is published from the browser. An operator uploads the `.xlsx`, reviews
what changed, and the app opens a pull request. Merging that pull request deploys the new prices.
The catalogue is still a committed, generated file (`src/data/catalogue.json`), so git history is the
audit trail and nothing about how prices reach production has changed. The CLI route
(`pnpm catalogue:build`) still works and produces byte-identical output.

## Monthly routine

1. Open `/admin` on the production site and sign in with the admin password.
2. Choose the file. It must be named exactly `Uniqbe Reseller Quotation YYYYMMDD.xlsx`
   (for example `Uniqbe Reseller Quotation 20261013.xlsx`). Do not rename it.
3. Click **Preview changes**. Nothing is saved at this step.
4. Read the result:
   - **Added / Removed / Repriced** are measured against the catalogue currently deployed.
   - **Large price changes** lists any repricing of 20% or more. Check these against the source.
   - **Warnings** lists products whose HKD/USD ratio is outside the 7.70–7.90 peg band. These are
     informational (a few appear in most lists) and do not block publishing.
5. Click **Create pull request**. Nothing goes live yet.
6. Open the pull request, check the `src/data/catalogue.json` diff and that CI is green
   (typecheck, lint, tests, `catalogue:check`), then merge. Vercel deploys on merge.

Submitting the same price list twice is safe: if a pull request for that date is already open, the page
links to it instead of creating another.

## What the upload refuses

| Message | Meaning | Fix |
|---|---|---|
| File must be named like `Uniqbe Reseller Quotation YYYYMMDD.xlsx` | Filename pattern or calendar date is wrong | Use the original filename |
| Larger than 2 MB, empty, or not a valid .xlsx | Wrong or damaged file | Re-export from the source |
| Date is not newer than the current price list | The deployed list is the same age or newer | Tick *Allow an older or same-date price list* only if that is intended |
| `Unmapped category "…"` | A new product category appeared | Add it to `CATEGORY_MAP` in `src/lib/catalogue-build/core.ts` **and** add duty and referral fee percentages for the new slug to both markets in `src/data/market-rules.json`, in a normal PR, then upload again |
| Duplicate `ProductCode` | The same code appears twice | Fix the spreadsheet |
| Blank row … still has data | A blank row would cut the list short | Delete the blank row |
| Expands to more than 50 MB, suspicious compression ratio, too many entries | Archive looks like a zip bomb | Re-export the workbook |

## Configuration

Set these in Vercel (Production and Preview) and in `.env.local` for local work. Never commit them.

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_UPLOAD_PASSWORD` | yes | The shared admin password. Use a long random value. |
| `ADMIN_SESSION_SECRET` | yes | Signs the session cookie. At least 32 characters, for example `openssl rand -base64 48`. |
| `GITHUB_PRICELIST_TOKEN` | to publish | Fine-grained personal access token, see below. |
| `GITHUB_REPO` | to publish | `owner/name` of this repository. |
| `GITHUB_BASE_BRANCH` | no | Branch the pull request targets. Defaults to `main`. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | in production | Already used for FX rates. The login rate limiter uses the same database. |

**GitHub token.** Create a fine-grained token limited to this one repository with only
*Contents: Read and write* and *Pull requests: Read and write*. Give it an expiry and put a reminder in
the calendar to rotate it. Keep branch protection on `main` with a required review, so a leaked password
or token can propose a change but cannot ship one.

**Without Redis, login is disabled in production.** A per-instance counter cannot limit guessing across
serverless instances, so the login endpoint answers 503 rather than running unprotected. Local
development without Redis uses an in-memory limiter.

If `GITHUB_PRICELIST_TOKEN` or `GITHUB_REPO` is missing, Preview still works and Create pull request
answers that publishing is not configured.

## Security properties

- Sign-in sets an `HttpOnly`, `SameSite=Strict` (and `Secure` in production) cookie that expires after
  2 hours. Every `/admin` and `/api/admin` request goes through `src/middleware.ts`, and each admin API
  handler checks the session again itself.
- Login allows 10 attempts per client per 15 minutes and 100 across all clients. The client is taken
  from Vercel's `x-vercel-forwarded-for` header, never from the spoofable `x-forwarded-for`.
- State-changing requests must be same-origin (matching `Origin`, or `Sec-Fetch-Site: same-origin`).
- Uploads need a `Content-Length`, are capped at 2 MB, and the zip structure is inspected before the
  workbook is parsed. Publishing re-validates the upload from scratch.
- Spreadsheet text placed in the pull request is flattened into one code block so it cannot add links,
  mentions or headings.
- **Kill switch:** rotating `ADMIN_SESSION_SECRET` signs everyone out immediately. Rotating
  `ADMIN_UPLOAD_PASSWORD` stops new sign-ins but does not end sessions that already exist.
- Failed sign-in attempts are rate limited but not logged.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Sign-in says "not configured" | `ADMIN_UPLOAD_PASSWORD` or `ADMIN_SESSION_SECRET` (32+ chars) is missing, or production has no Upstash Redis |
| Sign-in says "too many attempts" | Rate limit hit. Wait 15 minutes |
| Create pull request fails with "check the server logs" | GitHub rejected a call (expired token, missing permission, wrong `GITHUB_REPO`, protected branch rules). The Vercel function log has the status and route, never the token |
| "Branch pricelist/YYYYMMDD already exists without an open pull request" | A closed or merged pull request left its branch behind. The app never overwrites a branch, because it may hold someone's work. Delete the branch on GitHub, then upload again |

## Known limits

- **Correcting an uploaded list.** If a pull request for that date is already open, uploading a
  corrected file does *not* update it: the page says so and links the existing pull request. Close that
  pull request and delete its `pricelist/YYYYMMDD` branch on GitHub, then upload again.
- **Turn on "Automatically delete head branches"** in the repository settings. A merged pull request
  that leaves its branch behind blocks any later upload for the same date (the 409 above).
- **Wait for the deploy before the next upload.** The preview compares against the catalogue baked
  into the running deployment, not against `main`. If a merged price list has not finished deploying,
  the date check and the diff are measured against the older list.
- **Stricter build.** The workbook reader now stops with an error on a blank row that has data below
  it, and reads formula cells by their displayed text. An old workbook with a stray blank row that built
  before will fail `pnpm build` (via `catalogue:check`) until the blank row is removed.
- There is no minimum item count. A list that loses most products shows up as a large *Removed*
  count in the preview and in the pull request, and review is the safeguard.
- The pull request commits the workbook next to `catalogue.json`, so the existing "newest `.xlsx` in
  `pricelists/` wins" rule keeps working. Do not add an older-dated file to that folder.
- Pull request bodies are capped well under GitHub's size limit and say so when truncated.

## Testing

`pnpm verify` covers the logic with unit and route tests (GitHub is replaced by an in-test fake). The
browser flow is opt-in: `E2E_ADMIN_PASSWORD=<password> pnpm e2e e2e/admin-upload.spec.ts` against a local
production build needs Upstash credentials in `.env.local`. It uses one login attempt per browser project.
