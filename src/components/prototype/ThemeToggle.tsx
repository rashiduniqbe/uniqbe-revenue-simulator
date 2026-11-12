"use client";

import { useEffect, useState } from "react";
import styles from "./proto.module.css";

export type Theme = "light" | "dark";

const STORAGE_KEY = "uniqbe-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Storage can be blocked (private mode, policies); fall back to the system theme.
    return null;
  }
}

// `chosen` is the partner's explicit pick (null = follow the system) and is
// what goes on data-theme. `effective` is what is actually showing, for the icon.
// Both start as server-safe defaults and settle after mount, so hydration matches.
export function useProtoTheme(): { chosen: Theme | null; effective: Theme; toggle: () => void } {
  const [chosen, setChosen] = useState<Theme | null>(null);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setChosen(readStored());
    const query = window.matchMedia(DARK_QUERY);
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const effective: Theme = chosen ?? (systemDark ? "dark" : "light");

  function toggle() {
    const next: Theme = effective === "dark" ? "light" : "dark";
    setChosen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered across visits, but the switch still applies now.
    }
  }

  return { chosen, effective, toggle };
}

export function ThemeToggle({ effective, onToggle }: { effective: Theme; onToggle: () => void }) {
  const label = effective === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      onClick={onToggle}
      data-testid="proto-theme-toggle"
    >
      {effective === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
