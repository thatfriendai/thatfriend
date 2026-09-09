"use client";

import { useState } from "react";

export function MakePrivateButton({ tripId, onMadePrivate }: { tripId: string; onMadePrivate: () => void }) {
  const [pending, setPending] = useState(false);

  async function makePrivate() {
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: false }),
    });
    setPending(false);
    if (res.ok) onMadePrivate();
  }

  return (
    <button
      type="button"
      onClick={makePrivate}
      disabled={pending}
      className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[12.5px] text-ink hover:border-ink disabled:opacity-50"
    >
      {pending ? "…" : "Make private"}
    </button>
  );
}
