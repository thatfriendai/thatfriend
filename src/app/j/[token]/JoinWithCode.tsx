"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Join <trip>" for the per-phone invite link — the server already knows
 * which number this was sent to (resolved from the token, never put in the
 * page), so the tap sends a sign-in code straight to it and the code box
 * appears in place. Still one decision for the friend; the code is what
 * proves the phone is theirs (a forwarded link can't finish this, which is
 * the point — see src/lib/planner/joinLink.ts).
 */
export function JoinWithCode({
  token,
  phoneMasked,
  tripName,
}: {
  token: string;
  phoneMasked: string;
  tripName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"join" | "code">("join");
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v2/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the code — try again.");
        setPending(false);
        return;
      }
      setStep("code");
    } catch {
      setError("That's taking too long — try again in a bit.");
    }
    setPending(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/v2/auth/verify-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, code: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      setError(data.error ?? "That code didn't work.");
      return;
    }
    router.push(data.redirect ?? "/planner/home");
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-3">
        <p className="text-[14px] text-body">We texted a code to {phoneMasked}. Enter it and you&rsquo;re in.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="6-digit code"
          className="rounded-xl border border-input-border bg-card px-4.5 py-3.5 text-[17px] tracking-[0.12em] text-ink outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="flex items-center justify-center rounded-full bg-ink px-7 py-4 text-[16px] text-cream hover:bg-accent disabled:opacity-60"
        >
          {pending ? "Checking…" : `Join ${tripName}`}
        </button>
        {error && <p className="text-[13px] text-red-700">{error}</p>}
        <button type="button" onClick={sendCode} disabled={pending} className="self-start text-[13px] text-muted underline">
          Send it again
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-muted">You&rsquo;ll get texts from That Friend about this trip.</p>
      <button
        type="button"
        onClick={sendCode}
        disabled={pending}
        className="flex items-center justify-center rounded-full bg-ink px-7 py-4 text-[16px] text-cream hover:bg-accent disabled:opacity-60"
      >
        {pending ? "One sec…" : `Join ${tripName}`}
      </button>
      {error && <p className="text-[13px] text-red-700">{error}</p>}
      <p className="text-[13px] text-faint">
        Or just reply <span className="font-mono">1</span> to the text we sent {phoneMasked} — same thing.
      </p>
    </div>
  );
}
