# T-32 Vercel Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the simulator to Vercel production as spec §12 describes:
- region `lhr1` and Node 22
- Upstash Redis via the Marketplace
- a cron-secured daily FX refresh
- a protected preview, with E2E run against the preview URL
- the cron verified on 3 consecutive days

**Architecture:**
- **Code:** two tasks make the repo deploy-ready.
  - `vercel.json` pins the §12.2 settings, and a config test guards them.
  - Playwright learns to target an already-deployed URL, through a pure `e2e/target.ts`.
  - A new GitHub Actions workflow runs E2E against each Vercel preview once it finishes deploying.
- **Dashboard:** the rest is work only the human can do, marked **HUMAN**. The agent says exactly what to click, then verifies the result with `curl`.
- No Vercel CLI is installed, and none is needed.

**Tech Stack:** Next.js 15, pnpm 10.33.2, Node 22.x, Vitest 2, Playwright, GitHub Actions, Vercel (Hobby, or Pro without the Advanced Deployment Protection add-on), Upstash Redis via the Vercel Marketplace.

**Spec:** `PROJECT_SPEC.md`:
- §12.1, the pipeline: "Vercel Preview Deployment └─ Playwright E2E against the preview URL"
- §12.2, the Vercel configuration table
- §5, the cron and `CRON_SECRET`
- §14 T-32: "Cron fires and writes; verified over 3 consecutive days"
- §14 T-31: "Green on a preview deployment"

`AGENTS.md` also applies.

**Starting state (2026-10-02):**
- `main` is at `08530fd`. PRs #1 (Phase 6) and #2 (T-30 PostHog) are merged.
- The repo is already connected to Vercel: PR checks show "Vercel" and "Vercel Preview Comments".
- There is no `.vercel/` directory, and the Vercel CLI isn't installed.

**Decisions made by the human on 2026-10-02 (binding):**
1. **Preview protection uses Vercel Authentication, not Password Protection.** The account is Hobby, or Pro without the add-on.
   - Pilot partners use **production**, which stays public.
   - CI reaches protected previews through **Protection Bypass for Automation**.
2. **PostHog stays off.** Don't set `NEXT_PUBLIC_POSTHOG_KEY` in this ticket.

## Global Constraints

- **§12.2:**
  - Framework preset: Next.js
  - Build command: `pnpm build`
  - Install command: `pnpm install --frozen-lockfile`
  - Node: 22.x
  - Region: `lhr1`
  - Cron: `/api/cron/fx-refresh` at `0 6 * * *`
  - Upstash Redis via the Vercel Marketplace, which auto-injects both env vars
- **§5:** the cron handler verifies `Authorization: Bearer ${CRON_SECRET}` and returns 401 otherwise. This is already implemented in `src/app/api/cron/fx-refresh/route.ts`. Don't weaken it.
- **Redis env names:** `src/fx/store.ts` `redisFromEnv` accepts either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL`/`KV_REST_API_TOKEN`. The Marketplace integration injects one of these pairs. Don't rename anything.
- **Secrets:** never commit `CRON_SECRET`, the bypass secret or Redis credentials. Never paste them into a commit message, plan, PR body or any log you commit.
- **Invariants:**
  - AGENTS 1–6 stay intact.
  - `src/engine/**` and `data/golden-fixtures.json` stay untouched.
  - The FX badge and disclaimer stay on every converted-price screen.
- **Tooling:**
  - TypeScript strict, with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`; imports are relative.
  - Prettier: `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`. Run `pnpm prettier --write <changed files>` before each commit.
  - Vitest `include` is `tests/**/*.test.ts`.
- **Commits:** one task per commit, Conventional Commits. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Done means:** `pnpm verify`, `pnpm build` and `pnpm e2e` pass locally. Tasks 3–4 also need their listed HUMAN checks.
- **Stop and ask** before any merge, any push to `main`, or any change in the Vercel or GitHub dashboards. The HUMAN steps exist so the human makes those changes.

## Review Focus

1. **`PLAYWRIGHT_BASE_URL` set to something unusable**, such as an empty string, a value with no `https://`, or one with a trailing slash. The suite must fail fast with a clear message, never silently run against localhost. Pinned in Task 2 by the `resolveE2ETarget` tests.
2. **E2E against a deployment running specs that only work locally.** The analytics harness needs the local build's fake ingest host. The "no Redis" degraded-warning tests would fail against a preview that has real Redis. Both must skip when the target is a deployment. Pinned in Task 2 by the skips and the `AGAINST_DEPLOYMENT` test.
3. **A protected preview without the bypass secret.** Every request would hit Vercel's login wall, which looks like an app failure. The bypass header must be sent whenever the secret is set. Pinned in Task 2 by the header tests, and proven against a real preview in Task 3, Step 6.
4. **A hand edit to `vercel.json`** that changes the region, the cron schedule or the install command. The config test must fail. Pinned in Task 1.
5. **The cron fires but can't write**, because Upstash isn't connected or `CRON_SECRET` is wrong. Production would then quietly serve seed rates for days. Pinned in Task 3, Step 7: a manual cron call, plus `/api/fx` showing a non-seed provider. Task 4 repeats the check daily.

---

### Task 1: chore(deploy): pin the §12.2 Vercel settings in vercel.json

**Files:**
- Modify: `vercel.json`
- Test: `tests/config/vercel-config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `vercel.json` with `framework`, `installCommand`, `buildCommand`, `regions` and `crons`.

- [ ] **Step 1: Branch and commit this plan**

```bash
git checkout main && git pull && git checkout -b t32-vercel-production
git add docs/superpowers/plans/2026-10-02-t32-vercel-production.md
git commit -m "docs: add T-32 Vercel production plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing test.** Create `tests/config/vercel-config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type VercelConfig = {
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
  regions?: string[];
  crons?: { path: string; schedule: string }[];
};

const vercel = JSON.parse(readFileSync("vercel.json", "utf-8")) as VercelConfig;
const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { engines?: { node?: string } };

describe("vercel.json matches spec §12.2", () => {
  it("uses the Next.js preset with the spec's install and build commands", () => {
    expect(vercel.framework).toBe("nextjs");
    expect(vercel.installCommand).toBe("pnpm install --frozen-lockfile");
    expect(vercel.buildCommand).toBe("pnpm build");
  });

  it("runs functions in London only (lhr1)", () => {
    expect(vercel.regions).toEqual(["lhr1"]);
  });

  it("schedules exactly one cron: the daily FX refresh at 06:00 UTC", () => {
    expect(vercel.crons).toEqual([{ path: "/api/cron/fx-refresh", schedule: "0 6 * * *" }]);
  });

  it("pins Node 22.x via package.json engines (Vercel reads this)", () => {
    expect(pkg.engines?.node).toBe("22.x");
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run tests/config/vercel-config.test.ts`
Expected: FAIL. `framework`, `installCommand`, `buildCommand` and `regions` are all undefined. The cron and Node tests already pass.

- [ ] **Step 4: Replace `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm build",
  "regions": ["lhr1"],
  "crons": [{ "path": "/api/cron/fx-refresh", "schedule": "0 6 * * *" }]
}
```

Note: on Hobby, crons may fire any time within the scheduled hour (06:00–06:59 UTC), and only once a day is allowed. This schedule fits both limits.

- [ ] **Step 5: Run it and confirm it passes**

Run: `pnpm vitest run tests/config/vercel-config.test.ts`
Expected: PASS 4/4.

- [ ] **Step 6: Verify and commit**

Run: `pnpm prettier --write vercel.json tests/config && pnpm verify && pnpm build`
Expected: PASS.

```bash
git add vercel.json tests/config/vercel-config.test.ts
git commit -m "chore(deploy): pin spec §12.2 Vercel settings (lhr1, pnpm commands, cron) (T-32)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: test(e2e): run the E2E suite against a deployed preview URL

**Files:**
- Create: `e2e/target.ts`, `tests/e2e-target/target.test.ts`, `.github/workflows/e2e-preview.yml`
- Modify: `playwright.config.ts`, `e2e/analytics.spec.ts`, `e2e/simulator.spec.ts:43`, `e2e/compare.spec.ts:37`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `resolveE2ETarget(env: Record<string, string | undefined>): E2ETarget`
  - `type E2ETarget = { baseURL: string; startLocalServer: boolean; extraHTTPHeaders: Record<string, string> }`
  - `LOCAL_PORT = 3100`
  - `AGAINST_DEPLOYMENT: boolean`
  - the env vars `PLAYWRIGHT_BASE_URL` and `VERCEL_AUTOMATION_BYPASS_SECRET`
  - the GitHub secret `VERCEL_AUTOMATION_BYPASS_SECRET`, which Task 3 creates

- [ ] **Step 1: Write the failing test.** Create `tests/e2e-target/target.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LOCAL_PORT, resolveE2ETarget } from "../../e2e/target";

describe("resolveE2ETarget", () => {
  it("defaults to the local production build on port 3100", () => {
    expect(resolveE2ETarget({})).toEqual({
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      extraHTTPHeaders: {},
    });
    expect(LOCAL_PORT).toBe(3100);
  });

  it("treats a blank PLAYWRIGHT_BASE_URL as unset", () => {
    expect(resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "   " }).startLocalServer).toBe(true);
  });

  it("targets a deployment without starting a server, trailing slash removed", () => {
    const target = resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "https://x-git-pr-3.vercel.app/" });
    expect(target.baseURL).toBe("https://x-git-pr-3.vercel.app");
    expect(target.startLocalServer).toBe(false);
    expect(target.extraHTTPHeaders).toEqual({});
  });

  it("sends Vercel's automation-bypass headers when the secret is set", () => {
    const target = resolveE2ETarget({
      PLAYWRIGHT_BASE_URL: "https://x.vercel.app",
      VERCEL_AUTOMATION_BYPASS_SECRET: " s3cret ",
    });
    expect(target.extraHTTPHeaders).toEqual({
      "x-vercel-protection-bypass": "s3cret",
      "x-vercel-set-bypass-cookie": "true",
    });
  });

  it("fails fast on a base URL that isn't http(s)", () => {
    expect(() => resolveE2ETarget({ PLAYWRIGHT_BASE_URL: "x.vercel.app" })).toThrow(
      /PLAYWRIGHT_BASE_URL must start with http:\/\/ or https:\/\//,
    );
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run tests/e2e-target/target.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Create `e2e/target.ts`.** It is pure, with no Playwright import, so Vitest can test it.

```ts
export const LOCAL_PORT = 3100;

export type E2ETarget = {
  baseURL: string;
  startLocalServer: boolean;
  extraHTTPHeaders: Record<string, string>;
};

// Spec §12.1: E2E runs against the local production build by default, or
// against a deployed Vercel preview when PLAYWRIGHT_BASE_URL is set.
// Previews sit behind Vercel Authentication, so CI passes the
// "Protection Bypass for Automation" secret as a header.
export function resolveE2ETarget(env: Record<string, string | undefined>): E2ETarget {
  const external = env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
  if (external === "") {
    return {
      baseURL: `http://localhost:${LOCAL_PORT}`,
      startLocalServer: true,
      extraHTTPHeaders: {},
    };
  }
  if (!/^https?:\/\//i.test(external)) {
    throw new Error(
      `PLAYWRIGHT_BASE_URL must start with http:// or https:// (got "${external}")`,
    );
  }
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "";
  return {
    baseURL: external.replace(/\/+$/, ""),
    startLocalServer: false,
    extraHTTPHeaders:
      bypass === ""
        ? {}
        : { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
  };
}

// True when the suite targets a deployment. Specs that need the local build
// (fake analytics host, no Redis) skip themselves on this flag.
export const AGAINST_DEPLOYMENT = !resolveE2ETarget(process.env).startLocalServer;
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `pnpm vitest run tests/e2e-target/target.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Use the target in `playwright.config.ts`**
- Add `import { LOCAL_PORT, resolveE2ETarget } from "./e2e/target";`.
- Replace `const PORT = 3100;` with `const target = resolveE2ETarget(process.env);`.
- Change `use` to `{ baseURL: target.baseURL, extraHTTPHeaders: target.extraHTTPHeaders, trace: "retain-on-failure" }`.
- Make `webServer` conditional. Keep every existing field, the comment and the env block exactly as they are, with `PORT` renamed to `LOCAL_PORT`:

```ts
  webServer: target.startLocalServer
    ? {
        command: `pnpm build && pnpm start -p ${LOCAL_PORT}`,
        url: `http://localhost:${LOCAL_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        // (keep the existing comment and env block for the analytics harness verbatim)
        env: {
          NEXT_PUBLIC_POSTHOG_KEY: "phc_e2e_placeholder",
          NEXT_PUBLIC_POSTHOG_HOST: "http://127.0.0.1:3999",
        },
      }
    : undefined,
```

- [ ] **Step 6: Skip the local-only specs when targeting a deployment**
- In `e2e/simulator.spec.ts` (line 43) and `e2e/compare.spec.ts` (line 37), change `test.skip(!process.env.CI, "local runs may have real Redis credentials in .env.local");` to the following, and add `import { AGAINST_DEPLOYMENT } from "./target";` to both files:

```ts
  test.skip(
    !process.env.CI || AGAINST_DEPLOYMENT,
    "needs the no-Redis local CI build; locally .env.local or a deployment has real Redis",
  );
```

- In `e2e/analytics.spec.ts`, add `import { AGAINST_DEPLOYMENT } from "./target";`, then add this directly after the imports:

```ts
// The privacy harness needs the local E2E build's placeholder key and fake
// ingest host; a deployment has neither (PostHog is off until a key is set).
test.skip(AGAINST_DEPLOYMENT, "analytics harness runs only against the local E2E build");
```

- [ ] **Step 7: Create `.github/workflows/e2e-preview.yml`.** Vercel's GitHub integration sends a `deployment_status` event when a preview finishes deploying.

```yaml
name: E2E (Vercel preview)

on:
  deployment_status:

jobs:
  e2e-preview:
    if: >-
      github.event.deployment_status.state == 'success' &&
      startsWith(github.event.deployment_status.environment, 'Preview')
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.deployment.sha }}
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm e2e:install
      - run: pnpm e2e
        env:
          CI: "true"
          PLAYWRIGHT_BASE_URL: ${{ github.event.deployment_status.environment_url || github.event.deployment_status.target_url }}
          VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-preview
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 8: Verify locally**

Run: `pnpm prettier --write e2e playwright.config.ts tests/e2e-target .github && pnpm verify && pnpm build && pnpm e2e`
Expected:
- Verify and build PASS.
- Local E2E counts match `main`: 33 passed and 5 skipped. Nothing changes for local runs.

Then run the fail-fast check:
`PLAYWRIGHT_BASE_URL=not-a-url pnpm exec playwright test --list`
Expected: an error containing "PLAYWRIGHT_BASE_URL must start with http:// or https://".

- [ ] **Step 9: Commit**

```bash
git add e2e/target.ts tests/e2e-target playwright.config.ts e2e/analytics.spec.ts e2e/simulator.spec.ts e2e/compare.spec.ts .github/workflows/e2e-preview.yml
git commit -m "test(e2e): run Playwright against Vercel previews with automation bypass (T-31/T-32)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: HUMAN + verify — provision Vercel production (Upstash, CRON_SECRET, protection, region)

These are dashboard steps.
- The agent gives the human each step and waits for "done".
- The agent never asks for a secret value. The human pastes secrets only into the dashboards.
- The agent verifies results afterwards with `curl`.
- The agent asks the human for the production domain, which isn't a secret.

**Files:** none. If a step shows that code must change, rule on it and add a commit.

- [ ] **Step 1: Push the branch and open the PR.** Ask the human first, as the Global Constraints require.

```bash
git push -u origin t32-vercel-production
gh pr create --base main --title "T-32: Vercel production config + E2E against previews" --body "<summary + test plan; end with the Claude Code attribution line>"
```

- [ ] **Step 2: HUMAN, project settings.** In Vercel → Project → Settings:
  - **Build & Deployment:** Framework Preset is Next.js. The install and build commands come from `vercel.json`, so leave the override toggles off. **Node.js Version is 22.x.**
  - **Functions:** Function Region shows `lhr1`, which comes from `vercel.json`.

- [ ] **Step 3: HUMAN, Upstash.**
  1. Go to Vercel → Storage, or the Marketplace, and create **Upstash for Redis**.
  2. Choose a region close to `lhr1`: EU West (London), Ireland or Frankfurt.
  3. Connect it to this project for **Production and Preview**.
  4. Confirm that the project's Environment Variables now list `KV_REST_API_URL`/`KV_REST_API_TOKEN` or the `UPSTASH_REDIS_REST_*` pair.

- [ ] **Step 4: HUMAN, `CRON_SECRET`.**
  1. Generate a value locally with `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  2. Add it as `CRON_SECRET` for the **Production** environment.
  3. Keep a copy in a password manager for Step 7. Never paste it into chat or git.

- [ ] **Step 5: HUMAN, deployment protection and bypass.** In Vercel → Settings → Deployment Protection:
  1. Set **Vercel Authentication** to **Standard Protection**. This protects previews and leaves production public.
  2. Under **Protection Bypass for Automation**, create a secret.
  3. Add that secret in GitHub → repo → Settings → Secrets and variables → Actions, as `VERCEL_AUTOMATION_BYPASS_SECRET`.
  4. Redeploy the PR's latest preview with **Redeploy**, so the new env vars apply.

- [ ] **Step 6: Verify the preview E2E.**
  1. Wait for the "E2E (Vercel preview)" workflow on the PR. Check it with `gh run list --workflow e2e-preview.yml --limit 3`. If it fails, run `gh run view <id> --log-failed`.
  2. Expected: green.
     - The analytics specs and the two no-Redis specs report as skipped.
     - The other simulator, compare and a11y specs pass against the preview URL.
  3. If the trace shows a Vercel login page, the bypass secret is missing: Step 5's GitHub secret is missing or misnamed.

- [ ] **Step 7: Merge, then verify production.**
  1. Ask the human to merge the PR.
  2. Once the production deployment finishes, the human runs the commands below with their own secret. The agent never sees it.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-domain>/api/cron/fx-refresh
# Expected: 401 (no secret → unauthorized; §5)
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<prod-domain>/api/cron/fx-refresh
# Expected: {"ok":true,"provider":"frankfurter"} (or another live provider, never a 5xx)
curl -s https://<prod-domain>/api/fx
# Expected: "provider" is not "seed", "degraded": false, "fetchedAt" is today
```

The 401 check and the `/api/fx` check need no secret, so the agent can run those itself.

- **500 "store write failed":** Upstash isn't connected for Production. Recheck Step 3.
- **401 even with the secret:** the env var was added after the deploy or to the wrong environment. Fix it and redeploy.

- [ ] **Step 8: Browser smoke test on production.**
  1. Open `https://<prod-domain>/` with no Vercel login. It must load, because production is public.
  2. Pick a product and enter a price. The verdict, FX badge and disclaimer must be visible.
  3. Open `/compare?p=<code>&sp_uk=…&sp_au=…`. Both columns must render.
  4. The "This exchange rate is more than a few days old" warning must not appear, because rates are live.

---

### Task 4: verify — the cron fires and writes on 3 consecutive days (T-32 acceptance)

**Files:**
- Create: `docs/ops/fx-cron-verification.md`

- [ ] **Step 1: Create the log with the check command**

````markdown
# FX cron verification (T-32)

Acceptance (spec §14 T-32): "Cron fires and writes; verified over 3 consecutive days."
Cron: `/api/cron/fx-refresh` at `0 6 * * *` UTC. On Hobby it may fire any time 06:00–06:59 UTC.

Check, after 07:00 UTC each day:

```bash
curl -s https://<prod-domain>/api/fx
```

Pass when `provider` is not `seed`, `degraded` is `false`, and `fetchedAt` is that day's date (UTC).
Also confirm in Vercel → Project → Cron Jobs (or Logs) that the run returned 200.

| Day | Date (UTC) | fetchedAt | provider | degraded | Cron log status | Pass |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
````

- [ ] **Step 2: Record days 1–3.** This step spans three days, so a new chat can pick it up from this file.
  1. Each day, run the curl and fill in one row.
  2. Commit after each day with `docs(ops): record FX cron verification day N (T-32)`.
  3. Three consecutive passing rows meet the T-32 acceptance.

- [ ] **Step 3: If a day fails**, check Vercel → Logs for `/api/cron/fx-refresh`:
  - **401:** `CRON_SECRET` doesn't match.
  - **502:** both FX providers were down. Note it in the log; the day doesn't count.
  - **500:** the store write failed. Check the Upstash connection.

  Fix the cause, then restart the 3-day count.

## Out of scope

- The PostHog key: the human decided "not yet", so analytics stays off.
- Password Protection for previews: it needs the Pro add-on. Vercel Authentication is used instead.
- Adding `syd1`: spec §12.2 says to measure first, once Australia has real traffic.
- Migrating `vercel.json` to `vercel.ts`: optional, and §12.2 doesn't require it.
- The Phase 0 launch blockers, T-00 to T-04 (customs value, live fees, tax review, verdict threshold). These are business tasks, not code.
- A real-device check on an iPhone SE and a mid-range Android (spec §11.4 manual QA).
