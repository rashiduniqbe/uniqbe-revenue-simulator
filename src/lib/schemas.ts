import { z } from "zod";

export const CategorySlug = z.enum([
  "mobile-phone",
  "audio",
  "wearable",
  "tablet",
  "gaming",
  "camera",
  "smart-home",
  "computer-accessory",
  "home-appliance",
]);
export type CategorySlugType = z.infer<typeof CategorySlug>;

const categoryMap = (value: z.ZodTypeAny) =>
  z.object(
    Object.fromEntries(CategorySlug.options.map((s) => [s, value])) as Record<
      CategorySlugType,
      typeof value
    >,
  );

export const CatalogueItem = z.object({
  code: z.string().regex(/^[A-Z]{2}\d{5}$/),
  brand: z.string().min(1),
  name: z.string().min(1),
  categoryRaw: z.string().min(1),
  category: CategorySlug,
  categoryLabel: z.string().min(1),
  usd: z.number().int().positive(),
  hkdRef: z.number().int().positive(),
  storageGb: z.number().int().positive().nullable(),
  search: z.string(),
});
export type CatalogueItemType = z.infer<typeof CatalogueItem>;

export const Catalogue = z.object({
  schemaVersion: z.literal(1),
  sourceFile: z.string(),
  sourceSheet: z.literal("Pricelist"),
  priceListDate: z.string().date(),
  generatedAt: z.string().date(),
  baseCurrency: z.literal("USD"),
  referenceCurrency: z.literal("HKD"),
  productCount: z.number().int(),
  checksum: z.string(),
  items: z.array(CatalogueItem),
});
export type CatalogueType = z.infer<typeof Catalogue>;

const AmazonFees = z.object({
  referralFeePctDefault: z.number(),
  referralFeePctByCategory: categoryMap(z.number()),
  minReferralFee: z.number().optional(),
  individualPerItemFee: z.number(),
  professionalMonthlyFee: z.number(),
  feesAreTaxable: z.boolean(),
});

const EbayFees = z.object({
  referralFeePctDefault: z.number(),
  referralFeePctByCategory: categoryMap(z.number()),
  regulatoryFeePct: z.number(),
  perOrderFee: z.object({
    thresholdLocal: z.number(),
    low: z.number(),
    high: z.number(),
  }),
  tieredAbove: z.object({ thresholdLocal: z.number(), pctAbove: z.number() }).optional(),
  freeTierTrailingSalesLocal: z.number().optional(),
  individualPerItemFee: z.number(),
  feesAreTaxable: z.boolean(),
});

const ShopifyPlanFee = z.object({ pct: z.number(), fixed: z.number() });

const ShopifyFees = z.object({
  referralFeePctDefault: z.number(),
  monthlyByPlan: z.object({ basic: z.number(), grow: z.number(), advanced: z.number() }),
  payments: z.object({ basic: ShopifyPlanFee, grow: ShopifyPlanFee, advanced: ShopifyPlanFee }),
  subscriptionGstUnlessAbn: z.boolean().optional(),
  feesAreTaxable: z.boolean(),
  requiresAdSpendInput: z.boolean(),
});

const OtherFees = z.object({
  referralFeePctDefault: z.number(),
  feesAreTaxable: z.literal(false),
});

const MarketBlock = z.object({
  marketLabel: z.string(),
  currency: z.enum(["GBP", "AUD"]),
  locale: z.string(),
  consumptionTaxName: z.enum(["VAT", "GST"]),
  consumptionTaxRatePct: z.number(),
  deMinimisLocal: z.number().nullable(),
  deMinimisNote: z.string(),
  deMinimisComparand: z.enum(["goods", "goods+freight"]).optional(),
  deMinimisComparandNote: z.string().optional(),
  importTaxBase: z.string(),
  liableParty: z.string(),
  dutyPctByCategory: categoryMap(z.number()),
  platforms: z.object({
    amazon: AmazonFees,
    ebay: EbayFees,
    shopify: ShopifyFees,
    other: OtherFees,
  }),
});

export const MarketRules = z.object({
  _meta: z.object({
    schemaVersion: z.number(),
    sourceSection: z.string(),
    verificationStatus: z.string(),
    lastVerified: z.string().nullable(),
    specVersion: z.string(),
    changeLog: z.array(z.string()),
  }),
  UK: MarketBlock,
  AU: MarketBlock,
});
export type MarketRulesType = z.infer<typeof MarketRules>;

export const FxSnapshot = z.object({
  base: z.literal("USD"),
  rates: z.object({ GBP: z.number(), AUD: z.number() }),
  asOf: z.string().date(),
  fetchedAt: z.string(),
  provider: z.enum(["frankfurter", "fallback", "seed"]),
  degraded: z.boolean(),
  ageDays: z.number(),
});
export type FxSnapshotType = z.infer<typeof FxSnapshot>;
