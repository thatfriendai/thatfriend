"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * hasEmail distinguishes two genuinely different flows. With a real email
 * already on the account, this is Supabase's own self-service change —
 * confirming both the old and new address makes sense there, since both
 * are real. Phone-only accounts have no real "old" email to confirm (their
 * auth identity carries a synthetic placeholder — see lib/planner/
 * phoneSession.ts), so that goes through a separate server-driven route
 * instead; see /api/v2/users/me/email and the auth callback's
 * completePendingEmailLink for why.
 */
export function EmailChangePanel({ hasEmail }: { hasEmail: boolean }) {
  const [changing, setChanging] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);

    if (hasEmail) {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser(
        { email: trimmed },
        { emailRedirectTo: `${window.location.origin}/api/v2/auth/callback` }
      );
      setPending(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSent(true);
      return;
    }

    const res = await fetch("/api/v2/users/me/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send that.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-[13px] text-muted">
        {hasEmail
          ? `Check ${email} to confirm — your current email stays active until you do.`
          : `Check ${email} for a confirmation link to finish adding it.`}
      </p>
    );
  }

  if (!changing) {
    return (
      <button
        type="button"
        onClick={() => setChanging(true)}
        className="rounded-full border border-input-border bg-card px-4 py-1.5 text-[13.5px] text-ink hover:border-ink"
      >
        {hasEmail ? "Change" : "Add"}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2.5">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        autoFocus
        placeholder="new@email.com"
        className="rounded-full border border-input-border bg-card px-4 py-1.5 text-[14px] text-ink outline-none focus:border-ink"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-4 py-1.5 text-[13.5px] text-cream hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send confirmation"}
      </button>
      <button
        type="button"
        onClick={() => {
          setChanging(false);
          setError(null);
        }}
        className="text-[13.5px] text-muted hover:text-ink"
      >
        Cancel
      </button>
      {error && <span className="text-[13px] text-red-700">{error}</span>}
    </form>
  );
}
