"use client";

import { useState } from "react";

export function TripVisibilityToggle({ tripId, initialIsPublic }: { tripId: string; initialIsPublic: boolean }) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: next }),
    });
    setPending(false);
    if (!res.ok) setIsPublic(!next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title="Public trips show on your profile for friends to browse and copy"
      className={`rounded-full px-3 py-1 font-mono text-[10.5px] tracking-[0.08em] uppercase disabled:opacity-50 ${
        isPublic ? "bg-ink text-cream" : "border border-input-border bg-card text-muted"
      }`}
    >
      {isPublic ? "Public" : "Private"}
    </button>
  );
}
