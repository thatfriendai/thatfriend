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
      <span
        className="relative ml-1 h-4.5 w-8 flex-none rounded-full transition-colors"
        style={{ background: isPublic ? "var(--color-accent)" : "var(--color-input-border)" }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-card transition-transform"
          style={{ transform: isPublic ? "translateX(15px)" : "translateX(2px)" }}
        />
      </span>
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
