import type { ReactNode } from "react";
import type { Market } from "../../engine/types";
import { MarketTabs } from "./MarketTabs";
import { TEXT_LINK_CLASS } from "./control-classes";

interface PageHeaderProps {
  market: Market;
  onMarketChange: (market: Market) => void;
  priceListDate: string;
  fxBadge: ReactNode;
  compareHref?: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatPriceListDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? isoDate : DATE_FORMAT.format(parsed);
}

export function PageHeader({
  market,
  onMarketChange,
  priceListDate,
  fxBadge,
  compareHref = "/compare",
}: PageHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-3 border-b border-neutral-200 bg-white px-4 py-6 text-center">
      <h1 className="text-2xl font-semibold">Uniqbe Price Simulator</h1>
      <MarketTabs market={market} onChange={onMarketChange} />
      <a href={compareHref} className={TEXT_LINK_CLASS}>
        Compare UK vs Australia
      </a>
      <p className="text-sm text-neutral-600">
        Up-to-date as of {formatPriceListDate(priceListDate)}
      </p>
      {fxBadge}
    </header>
  );
}
