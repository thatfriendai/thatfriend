"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The friend's one tap. The line above it is the whole disclosure — tapping
 * is joining and consenting, same action (src/lib/planner/joinLink.ts).
 * Signed in: the join happens right here. Not yet: phone sign-in carries
 * the token through and verify-phone finishes the join, so there's still
 * no separate consent screen and no "reply JOIN" text afterwards.
 */
export function JoinTripButton({
  token,
  tripName,
  signedIn,
}: {
  token: string;
  tripName: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!signedIn) {
      router.push(`/planner/login?token=${encodeURIComponent(token)}`);
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/v2/join/${encodeURIComponent(token)}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      setError(data.error ?? "Something went wrong — try again.");
      return;
    }
    router.push(data.redirect ?? "/planner/home");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-muted">You&rsquo;ll get texts from That Friend about this trip.</p>
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="flex items-center justify-center rounded-full bg-ink px-7 py-4 text-[16px] text-cream hover:bg-accent disabled:opacity-60"
      >
        {pending ? "Joining…" : `Join ${tripName}`}
      </button>
      {error && <p className="text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
