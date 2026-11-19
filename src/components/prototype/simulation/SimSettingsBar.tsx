"use client";

import { useRef, useState } from "react";
import type { DisplayCurrency } from "../../../lib/display-currency";
import { TARGET_MARGINS, type TargetMarginPct } from "../../../lib/simulation/simulate";
import { useAdoptTypedValues } from "../../simulator/useAdoptTypedValues";
import { MoneyField, Segmented } from "../controls";
import proto from "../proto.module.css";
import styles from "./simulation.module.css";

export type SettingsValues = {
  targetMarginPct: TargetMarginPct;
  taxRegistered: boolean;
  inboundShipping: string;
  packaging: string;
  adSpend: string;
};

export type CostPatch = Partial<Omit<SettingsValues, "targetMarginPct">>;

interface SimSettingsBarProps {
  values: SettingsValues;
  currency: DisplayCurrency;
  invalid: boolean;
  onTargetChange: (target: TargetMarginPct) => void;
  onCostsChange: (next: CostPatch) => void;
}

const MARGIN_OPTIONS = TARGET_MARGINS.map((m) => ({ value: String(m), label: `${m}%` }));
const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

export function SimSettingsBar({
  values,
  currency,
  invalid,
  onTargetChange,
  onCostsChange,
}: SimSettingsBarProps) {
  const [open, setOpen] = useState(false);
  const refs = {
    inboundShipping: useRef<HTMLInputElement>(null),
    packaging: useRef<HTMLInputElement>(null),
    adSpend: useRef<HTMLInputElement>(null),
  };
  useAdoptTypedValues(
    refs,
    {
      inboundShipping: values.inboundShipping,
      packaging: values.packaging,
      adSpend: values.adSpend,
    },
    onCostsChange,
  );
  // The one-line summary shown when the settings are folded away on a phone.
  const summary = [
    `${values.targetMarginPct}%`,
    values.taxRegistered ? "GST registered" : "not GST registered",
    `ship ${currency} ${values.inboundShipping.trim() || "0"}`,
  ].join(" · ");

  return (
    <section className={`${proto.card} ${styles.settings}`} aria-label="Run settings">
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={open}
        aria-controls="sim-settings-body"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={proto.label}>Run settings</span>
        <span className={`${styles.disclosureSummary} ${proto.mono}`}>{summary}</span>
      </button>
      <div
        id="sim-settings-body"
        className={`${styles.settingsBody} ${open ? styles.settingsOpen : ""}`}
      >
        <Segmented
          label="Target net margin"
          options={MARGIN_OPTIONS}
          value={String(values.targetMarginPct)}
          onChange={(v) => onTargetChange(Number(v) as TargetMarginPct)}
        />
        <Segmented
          label="GST registered"
          options={YES_NO}
          value={values.taxRegistered ? "yes" : "no"}
          onChange={(v) => onCostsChange({ taxRegistered: v === "yes" })}
        />
        <MoneyField
          id="sim-shipping"
          label={`Shipping (${currency})`}
          inputRef={refs.inboundShipping}
          value={values.inboundShipping}
          onChange={(v) => onCostsChange({ inboundShipping: v })}
        />
        <MoneyField
          id="sim-packaging"
          label={`Packaging (${currency})`}
          inputRef={refs.packaging}
          value={values.packaging}
          onChange={(v) => onCostsChange({ packaging: v })}
        />
        <MoneyField
          id="sim-ad-spend"
          label={`Ad spend per sale (${currency})`}
          inputRef={refs.adSpend}
          value={values.adSpend}
          onChange={(v) => onCostsChange({ adSpend: v })}
        />
        <p className={styles.settingsNote}>
          Ad spend applies to Shopify and WooCommerce. Amazon Professional · Shopify Basic.
        </p>
        {invalid && (
          <p className={proto.notice} role="alert">
            Enter shipping, packaging and ad spend as amounts of 0 or more.
          </p>
        )}
      </div>
    </section>
  );
}
