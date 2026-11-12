import { MarketRules } from "../../../lib/schemas";
import marketRulesData from "../../../data/market-rules.json";
import { readFxSnapshot } from "../../../fx/store";
import { loadStorepriceCatalogue } from "../../../lib/storeprice/fetch";
import { AuPrototypeShell, PrototypeError } from "../../../components/prototype/AuPrototypeShell";

// Live FX (Redis) and a live price list: never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AuPrototypePage() {
  const rules = MarketRules.parse(marketRulesData);
  const [catalogue, fx] = await Promise.all([loadStorepriceCatalogue(), readFxSnapshot()]);

  // No fallback to the bundled catalogue by design: a stale list shown as live
  // would be worse than an honest error.
  if (!catalogue.ok) return <PrototypeError />;

  return (
    <AuPrototypeShell
      items={catalogue.items}
      skipped={catalogue.skipped}
      fetchedAt={catalogue.fetchedAt}
      rules={rules}
      fx={fx}
    />
  );
}
