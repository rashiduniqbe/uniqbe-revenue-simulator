"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const STATUS_MESSAGES: Record<number, string> = {
  401: "Incorrect password.",
  429: "Too many attempts. Try again in a few minutes.",
  503: "Admin login is not configured on this deployment.",
};
const FALLBACK_MESSAGE = "Could not sign in. Try again.";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      setError(STATUS_MESSAGES[response.status] ?? FALLBACK_MESSAGE);
    } catch {
      setError(FALLBACK_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Admin password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded border border-gray-400 px-3 py-2 text-base font-normal"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
