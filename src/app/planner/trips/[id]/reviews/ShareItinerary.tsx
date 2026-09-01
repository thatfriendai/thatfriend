"use client";

import { useState } from "react";
import { CopyInviteLink } from "../CopyInviteLink";

export function ShareItinerary({
  tripId,
  initialToken,
}: {
  tripId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [pending, setPending] = useState(false);

  async function createLink() {
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/share`, { method: "POST" });
    setPending(false);
    if (!res.ok) return;
    const data = await res.json();
    setToken(data.shareToken);
  }

  if (!token) {
    return (
      <button
        type="button"
        onClick={createLink}
        disabled={pending}
        className="rounded-full border border-input-border bg-card px-5.5 py-2.5 text-[14.5px] text-ink hover:border-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Get a shareable link"}
      </button>
    );
  }

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/planner/share/${token}`;
  return <CopyInviteLink url={url} />;
}
