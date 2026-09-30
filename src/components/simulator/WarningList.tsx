import type { EngineWarning } from "../../engine/types";
import { WARNING_COPY, sortWarningsByPriority } from "../../lib/warnings-copy";

interface WarningListProps {
  warnings: EngineWarning[];
}

export function WarningList({ warnings }: WarningListProps) {
  const sorted = sortWarningsByPriority(warnings);
  if (sorted.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((warning) => (
        <li
          key={warning.code}
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {WARNING_COPY[warning.code].message}
        </li>
      ))}
    </ul>
  );
}
