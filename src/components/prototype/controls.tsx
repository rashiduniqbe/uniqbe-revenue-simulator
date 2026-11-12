"use client";

import type { RefObject } from "react";
import styles from "./proto.module.css";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabledReason?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  hideLabel?: boolean;
}

// Box-converter style segmented control: a row of toggle buttons sharing one border.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  hideLabel = false,
}: SegmentedProps<T>) {
  return (
    <div className={`${styles.field} ${className ?? ""}`}>
      <span className={hideLabel ? "sr-only" : styles.label}>{label}</span>
      <div className={styles.seg} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            disabled={option.disabledReason !== undefined}
            title={option.disabledReason}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MoneyFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  placeholder?: string;
  hint?: string;
}

export function MoneyField({
  id,
  label,
  value,
  onChange,
  inputRef,
  placeholder,
  hint,
}: MoneyFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${styles.input} ${styles.mono}`}
        placeholder={placeholder}
        aria-describedby={hintId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
