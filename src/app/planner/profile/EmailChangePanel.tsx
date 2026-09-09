"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function EmailChangePanel() {
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
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ email: trimmed });
    setPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-[13px] text-muted">
        Check {email} to confirm — your current email stays active until you do.
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
        Change
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
