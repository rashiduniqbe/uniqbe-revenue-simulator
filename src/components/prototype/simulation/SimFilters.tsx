import type { CategoryOption } from "../../../lib/simulation/table";
import {
  GST_FILTERS,
  SORTS,
  type GstFilter,
  type SimSort,
} from "../../../lib/simulation/view-state";
import proto from "../proto.module.css";
import styles from "./simulation.module.css";

const SORT_LABEL: Record<SimSort, string> = {
  "cost-desc": "Uniqbe price, high to low",
  "cost-asc": "Uniqbe price, low to high",
  name: "Name",
  "profit-desc": "Most profit",
};

export type FilterPatch = { query?: string; category?: string; gst?: GstFilter; sort?: SimSort };

interface SimFiltersProps {
  query: string;
  category: string;
  gst: GstFilter;
  sort: SimSort;
  categories: CategoryOption[];
  total: number;
  thresholdText: string;
  onChange: (next: FilterPatch) => void;
}

export function SimFilters({
  query,
  category,
  gst,
  sort,
  categories,
  total,
  thresholdText,
  onChange,
}: SimFiltersProps) {
  const gstLabel: Record<GstFilter, string> = {
    all: "All",
    above: `${thresholdText} or more`,
    below: `Under ${thresholdText}`,
  };
  return (
    <section aria-label="Filters" className={styles.filters}>
      <div className={proto.field}>
        <label htmlFor="sim-search" className={proto.label}>
          Search
        </label>
        <input
          id="sim-search"
          type="search"
          autoComplete="off"
          className={proto.input}
          placeholder="Search by name or SKU"
          value={query}
          onChange={(e) => onChange({ query: e.target.value })}
        />
      </div>
      <div className={proto.field}>
        <label htmlFor="sim-category" className={proto.label}>
          Category
        </label>
        <select
          id="sim-category"
          className={proto.input}
          value={category}
          onChange={(e) => onChange({ category: e.target.value })}
        >
          <option value="all">All ({total})</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
      </div>
      <div className={proto.field}>
        <label htmlFor="sim-gst" className={proto.label}>
          GST line
        </label>
        <select
          id="sim-gst"
          className={proto.input}
          value={gst}
          onChange={(e) => onChange({ gst: e.target.value as GstFilter })}
        >
          {GST_FILTERS.map((g) => (
            <option key={g} value={g}>
              {gstLabel[g]}
            </option>
          ))}
        </select>
      </div>
      <div className={proto.field}>
        <label htmlFor="sim-sort" className={proto.label}>
          Sort
        </label>
        <select
          id="sim-sort"
          className={proto.input}
          value={sort}
          onChange={(e) => onChange({ sort: e.target.value as SimSort })}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
