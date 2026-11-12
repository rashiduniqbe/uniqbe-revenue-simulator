# Storeprice category mapping: plan

**Goal:** Show the storeprice products that are hidden today because their category has no duty or fee rate.

**Status:** Waiting for a decision. Nothing is changed until the mapping below is approved. A category mapping picks a duty rate, so it's a tax decision (AGENTS.md: "Do not invent a tax rule").

## The problem

`src/lib/storeprice/parse.ts` maps each storeprice `cat` through `CATEGORY_MAP` (`src/lib/catalogue-build/core.ts`). Rows with an unmapped category are skipped and named in the page header ("N not listed (no duty mapping for …)"). Two storeprice categories are unmapped today:

| Storeprice category | Products on 12 Nov 2026 |
|---|---|
| Fitness Tracker | Google Fitbit Air, 6 colour/edition variants (dropship US$122–158) |
| Speaker | Nothing CMF Speaker M E495 / S E494, 5 colour variants (dropship US$65–87) |

These are portable Bluetooth speakers, not smart speakers. Storeprice already has a separate "Smart Speaker" category, which is mapped to Smart Home. The list changes weekly, so counts here are for context only; don't hard-code them.

## Recommended mapping

| Storeprice category | Map to slug | Label | Why |
|---|---|---|---|
| Fitness Tracker | `wearable` | Smart Wearables | Wrist-worn activity trackers, the same kind of product as the existing "Smart Wearables" rows |
| Speaker | `audio` | Audio | Bluetooth audio output, the same family as "Earphones", which already maps to `audio` |

What each choice applies today, from `market-rules.json` (unverified, see the verification plan):

| Slug | AU duty | AU Amazon | AU eBay | UK duty | UK Amazon | UK eBay |
|---|---|---|---|---|---|---|
| `wearable` | 0% | 8% | 13.4% | 0% | 8% | 9% |
| `audio` | 0% | 8% | 13.4% | 0% | 8% | 9% |

**To confirm before approving:** the HS codes for these products, and that the duty for them matches the category rate. Activity trackers and loudspeakers sit under different tariff headings from phones and earphones. If either needs a different duty from its category, don't map it. Add a new slug instead (see the alternative below).

Alternative, if the duty differs: add new slugs (`fitness-tracker`, `speaker`) to `CategorySlug` in `src/lib/schemas.ts`. Each one then needs duty and referral-fee rates for **both** markets in `market-rules.json`, or the fee lookup throws. That is more work and needs verified rates.

## Steps once approved (developer)

1. Write the test first: in `tests/lib/storeprice-parse.test.ts`, assert that a "Fitness Tracker" row maps to `wearable` and a "Speaker" row maps to `audio`. Change the existing "skips … Fitness Tracker" test to use a made-up category, so the skip path stays covered.
2. Add to `CATEGORY_MAP` in `src/lib/catalogue-build/core.ts`:
   ```ts
   "fitness tracker": { slug: "wearable", label: "Smart Wearables" },
   speaker: { slug: "audio", label: "Audio" },
   ```
   Keys are lower-cased; `mapCategory` lower-cases the raw value.
3. Run `pnpm verify`. The xlsx catalogue build uses the same map, so run `pnpm catalogue:check` too. It should be unaffected unless the xlsx starts using these names.
4. Check `/`: the header's "not listed" note should be gone (or list only new unmapped categories). Search "Fitbit" and "CMF Speaker" and confirm both price.

## Ongoing

Storeprice can add new categories at any time. They stay hidden and are named in the header until mapped, never guessed. Repeat this process for each new one.
