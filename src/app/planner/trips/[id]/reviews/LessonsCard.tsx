"use client";

import { useState } from "react";
import { DAY_COLORS } from "@/lib/planner/itinerary";

interface Lesson {
  id: string;
  userId: string;
  who: string;
  body: string;
}

/**
 * "What would you do differently?" — asked once, after the trip. What's
 * saved here comes back as "Last time" on the next trip this group plans.
 */
export function LessonsCard({
  tripId,
  myUserId,
  initial,
}: {
  tripId: string;
  myUserId: string;
  initial: Lesson[];
}) {
  const [lessons, setLessons] = useState(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colorOf = new Map<string, string>();
  for (const l of lessons) if (!colorOf.has(l.userId)) colorOf.set(l.userId, DAY_COLORS[colorOf.size % DAY_COLORS.length]);

  async function save() {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/v2/trips/${tripId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save that.");
      return;
    }
    const { lesson } = await res.json();
    setLessons((list) => [...list, { id: lesson.id, userId: myUserId, who: "You", body: lesson.body }]);
    setDraft("");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v2/trips/${tripId}/lessons`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setLessons((list) => list.filter((l) => l.id !== id));
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4.5">
      <p className="mb-1 text-[15.5px] text-ink-body">What would you do differently?</p>
      <p className="mb-3.5 text-[13.5px] leading-normal text-ink-soft">
        One question, once. Answers are saved to this group and show up when you plan the next trip together.
      </p>
      {lessons.length > 0 && (
        <div className="mb-3.5 flex flex-col gap-2">
          {lessons.map((l) => (
            <div key={l.id} className="group flex items-center gap-2.5">
              <span
                className="flex h-5.5 w-5.5 flex-none items-center justify-center rounded-full font-mono text-[9px] text-on-accent"
                style={{ background: colorOf.get(l.userId) }}
              >
                {l.who.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[14.5px] leading-[1.45] text-ink-body">{l.body}</span>
              {l.userId === myUserId && (
                <button
                  type="button"
                  onClick={() => remove(l.id)}
                  aria-label="Remove"
                  className="ml-auto text-[14px] text-faint opacity-0 group-hover:opacity-100 hover:text-red-700 focus:opacity-100"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          maxLength={240}
          placeholder="Book the big dinner earlier…"
          className="min-w-0 flex-1 rounded-full border border-border bg-canvas px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.trim()}
          className="rounded-full bg-ink px-4.5 py-2.5 text-[14px] whitespace-nowrap text-cream hover:bg-accent disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save for next time"}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
