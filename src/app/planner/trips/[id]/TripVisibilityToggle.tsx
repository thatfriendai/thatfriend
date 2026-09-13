"use client";

import { useState } from "react";

export function TripVisibilityToggle({
  tripId,
  initialIsPublic,
  readOnly,
}: {
  tripId: string;
  initialIsPublic: boolean;
  readOnly?: boolean;
}) {
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

  const content = (
    <>
      <span className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">Privacy</span>
      {isPublic ? "Public" : "Private"}
    </>
  );
  const className = "flex items-center gap-1.5 rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[13px] text-ink";

  if (readOnly) {
    return <span className={className}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title="Public trips show on your profile for friends to browse and copy"
      className={`${className} hover:border-ink disabled:opacity-50`}
    >
      {content}
    </button>
  );
}
