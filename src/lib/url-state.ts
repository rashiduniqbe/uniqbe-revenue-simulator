import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import type { SimulationInput } from "../engine/types";

export type ScenarioParams = Omit<SimulationInput, "usd" | "category">;

export const scenarioParsers = {
  m: parseAsStringEnum(["UK", "AU"] as const).withDefault("UK"),
  p: parseAsString.withDefault(""),
  pl: parseAsStringEnum(["amazon", "ebay", "shopify", "other"] as const).withDefault("amazon"),
  reg: parseAsBoolean.withDefault(false),
  sp: parseAsString.withDefault(""),
  sh: parseAsString.withDefault("0.00"),
  pk: parseAsString.withDefault("0.00"),
  ad: parseAsString.withDefault("0.00"),
  du: parseAsString.withDefault(""),
  rf: parseAsString.withDefault(""),
  ap: parseAsStringEnum(["individual", "professional"] as const).withDefault("professional"),
  shp: parseAsStringEnum(["basic", "grow", "advanced"] as const).withDefault("basic"),
  abn: parseAsBoolean.withDefault(false),
  et: parseAsBoolean.withDefault(false),
};

export const DEFAULT_SCENARIO: ScenarioParams = {
  market: "UK",
  productCode: "",
  platform: "amazon",
  taxRegistered: false,
  sellingPriceLocal: "",
  inboundShippingLocal: "0.00",
  packagingLocal: "0.00",
  adSpendLocal: "0.00",
  dutyPct: "",
  referralFeePct: "",
  amazonPlan: "professional",
  shopifyPlan: "basic",
  shopifyHasAbn: false,
  ebayFreeTier: false,
};

export function decodeScenario(searchParams: URLSearchParams): ScenarioParams {
  return {
    market: scenarioParsers.m.parseServerSide(searchParams.get("m") ?? undefined),
    productCode: scenarioParsers.p.parseServerSide(searchParams.get("p") ?? undefined),
    platform: scenarioParsers.pl.parseServerSide(searchParams.get("pl") ?? undefined),
    taxRegistered: scenarioParsers.reg.parseServerSide(searchParams.get("reg") ?? undefined),
    sellingPriceLocal: scenarioParsers.sp.parseServerSide(searchParams.get("sp") ?? undefined),
    inboundShippingLocal: scenarioParsers.sh.parseServerSide(searchParams.get("sh") ?? undefined),
    packagingLocal: scenarioParsers.pk.parseServerSide(searchParams.get("pk") ?? undefined),
    adSpendLocal: scenarioParsers.ad.parseServerSide(searchParams.get("ad") ?? undefined),
    dutyPct: scenarioParsers.du.parseServerSide(searchParams.get("du") ?? undefined),
    referralFeePct: scenarioParsers.rf.parseServerSide(searchParams.get("rf") ?? undefined),
    amazonPlan: scenarioParsers.ap.parseServerSide(searchParams.get("ap") ?? undefined),
    shopifyPlan: scenarioParsers.shp.parseServerSide(searchParams.get("shp") ?? undefined),
    shopifyHasAbn: scenarioParsers.abn.parseServerSide(searchParams.get("abn") ?? undefined),
    ebayFreeTier: scenarioParsers.et.parseServerSide(searchParams.get("et") ?? undefined),
  };
}

export function encodeScenario(scenario: ScenarioParams): URLSearchParams {
  const params = new URLSearchParams();
  params.set("m", scenarioParsers.m.serialize(scenario.market));
  params.set("p", scenarioParsers.p.serialize(scenario.productCode));
  params.set("pl", scenarioParsers.pl.serialize(scenario.platform));
  params.set("reg", scenarioParsers.reg.serialize(scenario.taxRegistered));
  params.set("sp", scenarioParsers.sp.serialize(scenario.sellingPriceLocal));
  params.set("sh", scenarioParsers.sh.serialize(scenario.inboundShippingLocal));
  params.set("pk", scenarioParsers.pk.serialize(scenario.packagingLocal));
  params.set("ad", scenarioParsers.ad.serialize(scenario.adSpendLocal));
  params.set("du", scenarioParsers.du.serialize(scenario.dutyPct));
  params.set("rf", scenarioParsers.rf.serialize(scenario.referralFeePct));
  params.set("ap", scenarioParsers.ap.serialize(scenario.amazonPlan));
  params.set("shp", scenarioParsers.shp.serialize(scenario.shopifyPlan));
  params.set("abn", scenarioParsers.abn.serialize(scenario.shopifyHasAbn));
  params.set("et", scenarioParsers.et.serialize(scenario.ebayFreeTier));
  return params;
}

// Maps short parser keys to full field names for component use
function shortsToFull(
  shorts: ReturnType<typeof useQueryStates<typeof scenarioParsers>>[0],
): ScenarioParams {
  return {
    market: shorts.m as ScenarioParams["market"],
    productCode: shorts.p,
    platform: shorts.pl as ScenarioParams["platform"],
    taxRegistered: shorts.reg,
    sellingPriceLocal: shorts.sp,
    inboundShippingLocal: shorts.sh,
    packagingLocal: shorts.pk,
    adSpendLocal: shorts.ad,
    dutyPct: shorts.du,
    referralFeePct: shorts.rf,
    amazonPlan: shorts.ap as ScenarioParams["amazonPlan"],
    shopifyPlan: shorts.shp as ScenarioParams["shopifyPlan"],
    shopifyHasAbn: shorts.abn,
    ebayFreeTier: shorts.et,
  };
}

// Maps full field names back to short parser keys for URL updates
function fullToShorts(full: ScenarioParams) {
  return {
    m: full.market,
    p: full.productCode,
    pl: full.platform,
    reg: full.taxRegistered,
    sp: full.sellingPriceLocal,
    sh: full.inboundShippingLocal,
    pk: full.packagingLocal,
    ad: full.adSpendLocal,
    du: full.dutyPct,
    rf: full.referralFeePct,
    ap: full.amazonPlan,
    shp: full.shopifyPlan,
    abn: full.shopifyHasAbn,
    et: full.ebayFreeTier,
  };
}

export function useScenario(): [
  ScenarioParams,
  (next: ScenarioParams | ((prev: ScenarioParams) => ScenarioParams)) => void,
] {
  const [shorts, setShorts] = useQueryStates(scenarioParsers);

  const scenario = shortsToFull(shorts);

  const setScenario = (next: ScenarioParams | ((prev: ScenarioParams) => ScenarioParams)) => {
    const nextScenario = typeof next === "function" ? next(scenario) : next;
    setShorts(fullToShorts(nextScenario));
  };

  return [scenario, setScenario];
}
