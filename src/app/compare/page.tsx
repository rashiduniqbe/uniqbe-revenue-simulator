import { Catalogue, MarketRules } from "../../lib/schemas";
import catalogueData from "../../data/catalogue.json";
import marketRulesData from "../../data/market-rules.json";
import { readFxSnapshot } from "../../fx/store";
import { CompareShell } from "../../components/compare/CompareShell";

// Live FX (Redis-backed) — must never be statically prerendered. See src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const catalogue = Catalogue.parse(catalogueData);
  const rules = MarketRules.parse(marketRulesData);
  const fx = await readFxSnapshot();

  return <CompareShell catalogue={catalogue} rules={rules} fx={fx} />;
}
