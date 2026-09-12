# Agent rules

## Invariants — never violate

1. `src/engine/**` is pure. No React, no Next, no I/O, no `Date.now()`, no `Math.random()`.
2. Money is `Decimal` internally and a decimal string at every boundary. Never `number`.
3. Never edit `src/data/catalogue.json` by hand. Regenerate it.
   3a. Never hardcode a fact derived from the catalogue — no product counts, no
   category counts, no threshold splits. Compute at runtime or omit.
   3b. Never assert a row count in a test. The price list changes weekly.
4. Never change an expected value in `data/golden-fixtures.json` to make a test pass.
   A failing fixture means the code is wrong, or the spec changed and a human
   must approve the new value.
5. UK and AU tax logic stay in separate modules. No `if (market === "AU")` inside
   a shared tax function.
   5a. The AU A$1,000 test uses the comparand read from `market-rules.json`
   (`deMinimisComparand`, currently `"goods"`); never inline the rule.
   5b. There is no user-facing control for VAT/GST on platform fees. `taxRegistered`
   governs recoverability only. `_planParityDisableFeeTax` is test-only.
6. The FX badge and the invoice disclaimer render on every screen showing a
   converted price. Do not remove them to simplify a layout.

## Workflow

- Run `pnpm verify` before declaring any ticket done.
- One ticket per commit. Conventional Commits.
- Write the test first for anything in `src/engine/`.
- If a spec section is ambiguous, stop and ask. Do not invent a tax rule.
