"use client";

import { useState } from "react";

export function LoginForm({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/v2/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("That's taking too long — the email server may be rate-limited. Try again in a bit.");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-ink">Check your email for a sign-in link.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm text-ink/80">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-ink focus:border-accent focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Continue with email"}
      </button>
    </form>
  );
}
