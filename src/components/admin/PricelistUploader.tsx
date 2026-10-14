"use client";

import { useState, type FormEvent, type ReactNode } from "react";

type Item = { code: string; brand: string; name: string; usd: number };
type Repriced = { code: string; oldUsd: number; newUsd: number; pctChange: number };

export type PreviewSuccess = {
  ok: true;
  currentPriceListDate: string;
  newPriceListDate: string;
  checksum: string;
  diff: { added: Item[]; removed: Item[]; repriced: Repriced[] };
  warnings: string[];
  largeChanges: Repriced[];
};

type PreviewFailure = { ok: false; errors: string[] };

const NETWORK_ERROR = "Could not reach the server. Try again.";

function formatPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <details className="rounded border border-gray-300 p-3">
      <summary className="cursor-pointer font-medium">
        {title} ({count})
      </summary>
      <ul className="mt-2 space-y-1 text-sm">{children}</ul>
    </details>
  );
}

function PreviewResult({ result }: { result: PreviewSuccess }) {
  const { diff } = result;
  return (
    <div className="flex flex-col gap-4">
      <p>
        <strong>{result.newPriceListDate}</strong> replaces{" "}
        <strong>{result.currentPriceListDate}</strong>: {diff.added.length} added,{" "}
        {diff.removed.length} removed, {diff.repriced.length} repriced.
      </p>
      {result.warnings.length > 0 ? (
        <div role="note" className="rounded border border-amber-500 bg-amber-50 p-3 text-sm">
          <p className="font-medium">Warnings ({result.warnings.length})</p>
          <ul className="list-disc pl-5">
            {result.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.largeChanges.length > 0 ? (
        <div role="note" className="rounded border border-amber-500 bg-amber-50 p-3 text-sm">
          <p className="font-medium">Large price changes ({result.largeChanges.length})</p>
          <ul className="list-disc pl-5">
            {result.largeChanges.map((r) => (
              <li key={r.code}>
                {r.code}: ${r.oldUsd} → ${r.newUsd} ({formatPct(r.pctChange)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Section title="Added" count={diff.added.length}>
        {diff.added.map((i) => (
          <li key={i.code}>
            {i.code} {i.brand} {i.name} (${i.usd})
          </li>
        ))}
      </Section>
      <Section title="Removed" count={diff.removed.length}>
        {diff.removed.map((i) => (
          <li key={i.code}>
            {i.code} {i.brand} {i.name}
          </li>
        ))}
      </Section>
      <Section title="Repriced" count={diff.repriced.length}>
        {diff.repriced.map((r) => (
          <li key={r.code}>
            {r.code}: ${r.oldUsd} → ${r.newUsd} ({formatPct(r.pctChange)})
          </li>
        ))}
      </Section>
    </div>
  );
}

export function PricelistUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [allowOlder, setAllowOlder] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<PreviewSuccess | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setIsPending(true);
    setErrors([]);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (allowOlder) form.set("allowOlder", "true");
      const response = await fetch("/api/admin/pricelist/preview", { method: "POST", body: form });
      if (response.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      const body = (await response.json()) as PreviewSuccess | PreviewFailure;
      if (body.ok) setResult(body);
      else setErrors(body.errors);
    } catch {
      setErrors([NETWORK_ERROR]);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reseller price list (.xlsx)
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-base font-normal"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowOlder}
            onChange={(event) => setAllowOlder(event.target.checked)}
          />
          Allow an older or same-date price list
        </label>
        <button
          type="submit"
          disabled={!file || isPending}
          className="self-start rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {isPending ? "Checking…" : "Preview changes"}
        </button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-4">
        {errors.length > 0 ? (
          <div role="alert" className="rounded border border-red-600 bg-red-50 p-3 text-sm">
            <p className="font-medium">This file can’t be used:</p>
            <ul className="list-disc whitespace-pre-wrap pl-5">
              {errors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {result ? <PreviewResult result={result} /> : null}
      </div>
    </div>
  );
}
