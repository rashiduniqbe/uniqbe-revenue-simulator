import type { ReactNode } from "react";

export function CalculatorCard({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="calculator-card"
      className="mx-auto flex w-full max-w-3xl flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6"
    >
      {children}
    </div>
  );
}
