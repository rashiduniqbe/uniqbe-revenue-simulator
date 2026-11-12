# Market rules verification: plan

**Goal:** Every duty, tax and platform-fee figure in `src/data/market-rules.json` is checked against an official source, recorded, and stamped verified. Until then every profit result is indicative.

**Why now:** `_meta.verificationStatus` reads "INDICATIVE — Phase 0 must re-verify every rate … before launch" and `_meta.lastVerified` is `null`. The AU calculator is about to become the main page at `/`; the UK calculator stays live at `/uk`, so both markets need verifying.

**Who:** A person with access to the seller accounts and, for duty, ideally a customs broker. The agent prepares the edit and tests; it must not pick or change a rate itself (AGENTS.md: "Do not invent a tax rule").

---

## 1. What to check

Fill in the **Verified** and **Source / date** columns. If a figure differs, write the new value; don't edit the JSON by hand yet.

### AU (`market-rules.json` → `AU`)

| Field | Current | Where to check | Verified | Source / date |
|---|---|---|---|---|
| `consumptionTaxRatePct` (GST) | 10 | ATO: GST on imported goods | | |
| `deMinimisLocal` (low-value threshold) | 1000 (A$) | ABF / ATO: GST on low value imported goods | | |
| `deMinimisComparand` | `"goods"` | Customs broker. **Provisional**: changelog 1.2 says "pending customs-broker confirmation". | | |
| `importTaxBase` | goods + shipping + duty | ATO: value of taxable importation | | |
| `liableParty` | reseller | Uniqbe's terms and the customs broker | | |
| `dutyPctByCategory` (9 categories) | 0, except home-appliance 5 | ABF Working Tariff (Schedule 3) by HS code; check FTA rates (e.g. ChAFTA, AHKFTA) for the actual origin | | |
| Amazon referral % by category | 8, except home-appliance 15 | Amazon Seller Central AU: selling fees | | |
| Amazon `individualPerItemFee` | 0.99 | Seller Central AU: selling plans | | |
| Amazon `professionalMonthlyFee` | 49.95 | Seller Central AU: selling plans | | |
| eBay final value fee % by category | 13.4 (all) | eBay AU: selling fees for business sellers | | |
| eBay `tieredAbove` | 2.5% above A$4,000 | eBay AU: selling fees | | |
| eBay `freeTierTrailingSalesLocal` | 25000 | eBay AU: private/free-tier rules | | |
| Shopify `monthlyByPlan` | basic 56, grow 149, advanced 575 | Shopify AU pricing page (AUD, monthly billing) | | |
| Shopify Payments `pct` / `fixed` | 1.75/0.30, 1.6/0.30, 1.4/0.30 | Shopify AU pricing: online card rates | | |
| `subscriptionGstUnlessAbn` | true | Shopify AU: GST on subscription | | |

### UK (`market-rules.json` → `UK`)

| Field | Current | Where to check | Verified | Source / date |
|---|---|---|---|---|
| `consumptionTaxRatePct` (import VAT) | 20 | GOV.UK: VAT on goods imported | | |
| `deMinimisLocal` | null (VAT always charged) | GOV.UK: goods sent from abroad (£135 rule) | | |
| `importTaxBase` | goods + shipping + duty | GOV.UK: valuing imports for VAT | | |
| `dutyPctByCategory` (9 categories) | 0 (all) | UK Trade Tariff by commodity code | | |
| Amazon referral % by category | 7 / 8, home-appliance 15 | Amazon Seller Central UK: selling fees | | |
| Amazon `minReferralFee` | 0.25 | Seller Central UK | | |
| Amazon `individualPerItemFee` | 0.75 | Seller Central UK: selling plans | | |
| Amazon `professionalMonthlyFee` | 25 | Seller Central UK: selling plans | | |
| eBay final value fee % by category | 8 / 9 | eBay UK: business seller fees | | |
| eBay `regulatoryFeePct` | 0.42 | eBay UK: regulatory operating fee | | |
| eBay `perOrderFee` | £0.30 ≤ £10, £0.40 above | eBay UK: business seller fees | | |
| Shopify `monthlyByPlan` | 25 / 65 / 344 | Shopify UK pricing page (GBP) | | |
| Shopify Payments `pct` / `fixed` | 2/0.25, 1.7/0.25, 1.5/0.25 | Shopify UK pricing: online card rates | | |

### Category HS codes (duty depends on these)

For each category, record the HS code you used: mobile-phone, tablet, audio, wearable, camera, gaming, smart-home, computer-accessory, home-appliance. The engine applies one duty % per category, so if products in one category fall under different codes with different rates, flag it. That category would need splitting, which is a spec change.

---

## 2. Apply the results (developer, one PR)

1. Create the branch `chore/verify-market-rules`.
2. Update each changed value in `src/data/market-rules.json` from the filled table. Rules stay data; nothing is inlined in code (AGENTS.md 5a).
3. Set `_meta.lastVerified` to the verification date (`YYYY-MM-DD`). Set `_meta.verificationStatus` to `"VERIFIED"` plus the verifier's name. Add a `_meta.changeLog` entry listing every changed field.
4. If AU `deMinimisComparand` was confirmed, drop "provisional" from changelog 1.2's follow-up. If it changed, set it via the JSON only.
5. Run `pnpm verify`.
   - **If a golden fixture fails, do not edit `data/golden-fixtures.json` to make it pass** (AGENTS.md 4). List each changed expected value in the PR, with the rule change that caused it, and get a human sign-off before updating the fixture.
6. Commit the filled-in table from section 1 into this file, as the audit trail.
7. In the PR description, quote the sources and dates and attach screenshots of the fee pages.

## 3. Done when

- [ ] Every row in section 1 has a verified value, a source and a date
- [ ] `market-rules.json` matches the table; `_meta.lastVerified` is set and the status is not "INDICATIVE"
- [ ] `pnpm verify` passes; any golden-fixture changes were signed off by a human
- [ ] A re-check date is set (suggest quarterly: platform fees change without notice)
