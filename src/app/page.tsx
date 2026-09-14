import { Catalogue, MarketRules } from "../lib/schemas";
import catalogueData from "../data/catalogue.json";
import marketRulesData from "../data/market-rules.json";
import { readFxSnapshot } from "../fx/store";
import { SimulatorShell } from "../components/simulator/SimulatorShell";

export default async function HomePage() {
  const catalogue = Catalogue.parse(catalogueData);
  const rules = MarketRules.parse(marketRulesData);
  const fx = await readFxSnapshot();

  return <SimulatorShell catalogue={catalogue} rules={rules} fx={fx} />;
}
