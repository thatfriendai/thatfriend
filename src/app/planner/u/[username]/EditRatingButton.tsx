"use client";

import { useState } from "react";

export function EditRatingButton({
  tripId,
  placeId,
  rating,
  body,
  onSaved,
}: {
  tripId: string;
  placeId: string;
  rating: number;
  body: string | null;
  onSaved: (rating: number, body: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftRating, setDraftRating] = useState(rating);
  const [draftBody, setDraftBody] = useState(body ?? "");
  const [pending, setPending] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-full border border-input-border bg-card px-3.5 py-1.5 text-[12.5px] text-ink hover:border-ink"
      >
        Edit rating
      </button>
    );
  }

  async function save() {
    setPending(true);
    const res = await fetch(`/api/v2/trips/${tripId}/places/${placeId}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: draftRating, body: draftBody.trim() || undefined }),
    });
    setPending(false);
    if (!res.ok) return;
    onSaved(draftRating, draftBody.trim() || null);
    setEditing(false);
  }

  return (
    <div className="mt-3 flex w-full flex-col gap-2 border-t border-border-soft pt-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-1 font-mono text-[16px]">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setDraftRating(n)}
            className={n <= draftRating ? "text-ink" : "text-ink-ghost"}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={draftBody}
        onChange={(e) => setDraftBody(e.target.value.slice(0, 500))}
        rows={2}
        placeholder="What made it worth it?"
        className="w-full resize-none rounded-xl border border-input-border bg-card px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={save}
          disabled={pending || draftRating < 1}
          className="rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] text-cream hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraftRating(rating);
            setDraftBody(body ?? "");
          }}
          className="text-[12.5px] text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
