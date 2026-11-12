# Admin Price List Upload: Production Setup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 2 and 3 involve secrets and GitHub/Vercel account actions that only the repo owner can perform; the agent prepares and verifies, the owner pastes values.

**Goal:** Make `/admin` price list upload and "Create pull request" work end to end on the production Vercel deployment.

**Architecture:** No code changes. The feature (PR #8) reads four server env vars plus the Upstash Redis pair already used for FX rates. This plan provisions those, hardens the GitHub repo so a leaked credential can only propose a change, redeploys (env vars apply only to new deployments), and smoke-tests with a throwaway PR.

**Tech Stack:** Vercel (env vars, Upstash Marketplace integration), GitHub fine-grained PAT, `vercel` CLI via `npx vercel` (not installed globally), `gh` CLI (authenticated as `rashiduniqbe`).

**Spec:** `docs/ops/pricelist-upload.md` (Configuration, Security properties, Troubleshooting, Known limits)

## Global Constraints

- Variables, verbatim: `ADMIN_UPLOAD_PASSWORD` (required), `ADMIN_SESSION_SECRET` (required, at least 32 characters), `GITHUB_PRICELIST_TOKEN` (to publish), `GITHUB_REPO` (to publish, `owner/name` form), `GITHUB_BASE_BRANCH` (optional, defaults to `main`), `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (production; `KV_REST_API_URL` / `KV_REST_API_TOKEN` is also accepted by `src/fx/store.ts`).
- Set in Vercel for **Production and Preview**. Never commit values; never paste them into chat, a PR, or a log.
- GitHub token: fine-grained, limited to this one repository, only *Contents: Read and write* and *Pull requests: Read and write*, with an expiry.
- Branch protection on `main` with a required review stays on.
- Without Redis, production login answers 503 by design. Do not work around it.
- `GITHUB_REPO` for this project is `rashiduniqbe/uniqbe-revenue-simulator`.

## Review Focus

- Env vars added but no redeploy: the live deployment still has the old env and sign-in says "not configured". Expect a fresh deployment after the last variable change.
- Secret pasted with a trailing space or newline: password never matches, or the session secret falls under 32 characters. Expect values to be set without whitespace.
- Variables set for Production only: Preview deployments show 503 on login. Expect both environments, or a deliberate note that Preview is unsupported.
- `GITHUB_REPO` entered as a full URL or with `.git`: `parseGithubRepo` rejects it and publish answers "not configured". Expect exactly `owner/name`.
- Token expiry or missing permission: Create pull request fails with "check the server logs" and the cause is only in the Vercel function log. Expect an expiry date recorded and a rotation reminder.
- Smoke-test branch left behind: `pricelist/YYYYMMDD` exists with no open PR, so the real upload for that date hits the 409. Expect the test PR closed and its branch deleted.

---

### Task 1: Confirm Upstash Redis is attached to Production and Preview

**Files:**
- None modified.

**Interfaces:**
- Consumes: the FX feature's existing Redis (`src/fx/store.ts` `redisFromEnv`).
- Produces: Redis env pair present in both environments, which the login rate limiter (`getLoginStore` in `src/lib/admin/rate-limit.ts`) needs.

- [ ] **Step 1: List env vars for the linked project**

Run: `npx vercel env ls`
Expected: rows for `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`), each listing Production and Preview. If `npx vercel` asks to log in or link, run `npx vercel login` and `npx vercel link` first.

- [ ] **Step 2: If either environment is missing, attach it**

In the Vercel dashboard: Project, Storage, the existing Upstash database, Connect Project, tick Production and Preview. Then repeat Step 1.
Expected: the pair now lists both environments.

- [ ] **Step 3: Record the result**

Note in the PR #8 conversation (no values): "Redis env present in Production and Preview."

### Task 2: Generate and set the two admin secrets

**Files:**
- None in the repo. Values live only in Vercel (and optionally `.env.local`, which is gitignored).

**Interfaces:**
- Consumes: nothing.
- Produces: `ADMIN_UPLOAD_PASSWORD` and `ADMIN_SESSION_SECRET` in Production and Preview, read by `src/app/api/admin/login/route.ts`, `src/middleware.ts` and `src/lib/admin/guard.ts`.

- [ ] **Step 1: Confirm `.env.local` is ignored**

Run: `git check-ignore -v .env.local`
Expected: a line naming a `.gitignore` rule. If empty, stop and fix `.gitignore` before continuing.

- [ ] **Step 2: Generate the values in the owner's terminal**

Run (Git Bash): `openssl rand -base64 48` twice. First output is the session secret. For the password, either the second output or a password-manager generated value of 20+ characters.
Expected: each is a single line with no spaces; the session secret is 64 characters.

- [ ] **Step 3: Set them for both environments without trailing whitespace**

For each of `ADMIN_UPLOAD_PASSWORD` and `ADMIN_SESSION_SECRET`, run `npx vercel env add <NAME> production` and then `npx vercel env add <NAME> preview`, pasting the value at the prompt. Alternatively use the dashboard: Project, Settings, Environment Variables, check Production and Preview.
Expected: CLI reports "Added Environment Variable".

- [ ] **Step 4: Store the password in the owner's password manager**

The password is not recoverable from Vercel (values are write-only for sensitive vars). Save it now.

### Task 3: Create the GitHub token, set it, and harden the repo

**Files:**
- None in the repo.

**Interfaces:**
- Consumes: nothing from earlier tasks; independent of Task 2.
- Produces: `GITHUB_PRICELIST_TOKEN` and `GITHUB_REPO` in Production and Preview, read by `readGithubConfig` in `src/lib/admin/github-pr.ts`; repo settings that stop a leaked credential from shipping a change.

- [ ] **Step 1: Create the fine-grained token**

GitHub, Settings, Developer settings, Fine-grained tokens, Generate new token.
- Resource owner: `rashiduniqbe`
- Repository access: Only select repositories, `uniqbe-revenue-simulator`
- Permissions: Contents: Read and write; Pull requests: Read and write. Nothing else (Metadata read is added automatically).
- Expiration: 90 days.
Expected: token string starting `github_pat_`.

- [ ] **Step 2: Add a rotation reminder**

Create a calendar event 1 week before the expiry date titled "Rotate GITHUB_PRICELIST_TOKEN (Vercel, Production and Preview)".

- [ ] **Step 3: Set the token and repo in Vercel**

Run `npx vercel env add GITHUB_PRICELIST_TOKEN production` and `... preview`, pasting the token.
Run `npx vercel env add GITHUB_REPO production` and `... preview`, entering exactly: `rashiduniqbe/uniqbe-revenue-simulator`
Leave `GITHUB_BASE_BRANCH` unset (defaults to `main`).
Expected: "Added Environment Variable" four times.

- [ ] **Step 4: Turn on automatic head-branch deletion**

Run: `gh api -X PATCH repos/rashiduniqbe/uniqbe-revenue-simulator -f delete_branch_on_merge=true --jq .delete_branch_on_merge`
Expected: `true`

- [ ] **Step 5: Check branch protection on `main`**

Run: `gh api repos/rashiduniqbe/uniqbe-revenue-simulator/branches/main/protection --jq '.required_pull_request_reviews.required_approving_review_count'`
Expected: a number of 1 or more. If the call returns 404 ("Branch not protected"), enable protection in GitHub: Settings, Branches, rule for `main`, require a pull request with 1 approval and require status checks. Note for a solo owner: a required review means the owner cannot approve their own PR unless bypass is allowed or a second reviewer exists. Decide that explicitly with the owner; do not weaken the rule silently.

- [ ] **Step 6: Verify the token can reach the repo, using the token itself (owner terminal)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" -H "X-GitHub-Api-Version: 2022-11-28" "https://api.github.com/repos/rashiduniqbe/uniqbe-revenue-simulator/pulls?state=open"` with `TOKEN` set in that shell only (do not echo it, then `unset TOKEN`).
Expected: `200`. `401` means a bad or expired token; `404` means the token is not scoped to this repo.

### Task 4: Ship the code and redeploy with the new env

**Files:**
- None modified.

**Interfaces:**
- Consumes: PR #8 (https://github.com/rashiduniqbe/uniqbe-revenue-simulator/pull/8) and Tasks 1 to 3.
- Produces: a production deployment that contains the admin routes and has the new env.

- [ ] **Step 1: Confirm CI is green on PR #8**

Run: `gh pr checks 8`
Expected: all checks pass. Stop and report any failure.

- [ ] **Step 2: Merge PR #8 once approved**

Run: `gh pr merge 8 --squash --delete-branch` only after the owner approves (the repo requires review). Vercel deploys on merge.
Expected: PR state `MERGED`.

- [ ] **Step 3: Confirm the production deployment is the post-env one**

Run: `npx vercel ls --prod` and take the newest deployment; its age must be later than the last `env add`. If it is older, run `npx vercel redeploy <deployment-url>`.
Expected: newest production deployment status `Ready`, created after the final env change.

### Task 5: Production smoke test

**Files:**
- None modified.

**Interfaces:**
- Consumes: the live production URL (`<prod-url>`), the admin password from Task 2, and a real or sample price list file named `Uniqbe Reseller Quotation YYYYMMDD.xlsx` dated after the deployed list (20261013).
- Produces: confirmation that sign-in, preview and publish work, with no residue left behind.

- [ ] **Step 1: Signed-out guard**

Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<prod-url>/admin`
Expected: a redirect to the login page, not `200` with the upload form.

- [ ] **Step 2: Wrong password is rejected**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<prod-url>/api/admin/login -H "content-type: application/json" -d '{"password":"definitely-wrong"}'`
Expected: `401`. A `503` means env or Redis is not live (see Review Focus); a `429` means the rate limit was hit, wait 15 minutes.

- [ ] **Step 3: Sign in through the browser and preview**

Open `https://<prod-url>/admin`, sign in, choose the file, click **Preview changes**.
Expected: Added / Removed / Repriced counts shown; nothing saved.

- [ ] **Step 4: Create the pull request**

Click **Create pull request**.
Expected: the page links to a new PR titled `chore(catalogue): reseller price list YYYYMMDD` with the workbook and `src/data/catalogue.json` in the diff. If it fails with "check the server logs", read `npx vercel logs <prod-url>` for the status and route (the token is never logged).

- [ ] **Step 5: If this was a throwaway file, clean up**

Run: `gh pr close <number> --delete-branch`
Expected: PR closed and `pricelist/YYYYMMDD` branch gone. Verify: `git ls-remote --heads origin "pricelist/*"` prints nothing for that date. If this was the real monthly list, skip this step and review and merge the PR normally.

- [ ] **Step 6: Kill switch drill (optional, 2 minutes)**

Rotate `ADMIN_SESSION_SECRET` (Task 2 Steps 2 and 3, redeploy) and confirm the browser session is signed out. Skip if the owner does not want a redeploy now.

### Task 6: Record completion in the runbook

**Files:**
- Modify: `docs/ops/pricelist-upload.md` (add the token expiry date to the "GitHub token" paragraph, no secret values).

**Interfaces:**
- Consumes: the token expiry date from Task 3 Step 1.
- Produces: a runbook that tells the next operator when to rotate.

- [ ] **Step 1: Add one line under "GitHub token"**

```markdown
Current token expires on YYYY-MM-DD. Rotate it before then and update `GITHUB_PRICELIST_TOKEN` in Production and Preview.
```

- [ ] **Step 2: Run the project gate**

Run: `pnpm verify`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add docs/ops/pricelist-upload.md docs/superpowers/plans/2026-10-21-admin-pricelist-production-setup.md
git commit -m "docs: production setup plan and token expiry note for admin price list upload"
```
