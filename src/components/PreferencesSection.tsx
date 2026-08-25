"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { submitPreference, setPreferencesVisibility } from "@/app/trip/[id]/actions";
import { useGuestIdentity } from "@/components/GuestIdentity";
import type {
  PreferenceWithParticipant,
  PreferencesVisibility,
} from "@/lib/supabase/types";

export function PreferencesSection({
  tripId,
  preferences,
  visibility,
}: {
  tripId: string;
  preferences: PreferenceWithParticipant[];
  visibility: PreferencesVisibility;
}) {
  const { name, participantId, setParticipantId } = useGuestIdentity();
  const [state, formAction, pending] = useActionState(submitPreference, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.participantId) setParticipantId(state.participantId);
    if (state?.success) formRef.current?.reset();
  }, [state, setParticipantId]);

  // Hidden until this participant has logged at least one preference of
  // their own — seeing others' answers first anchors people toward them,
  // which defeats the point of asking everyone independently.
  const unlocked = preferences.some((pref) => pref.participant_id === participantId);
  const isPrivate = visibility === "private";

  function changeVisibility(next: PreferencesVisibility) {
    if (next === visibility) return;
    setVisibilityError(null);
    startTransition(async () => {
      const result = await setPreferencesVisibility(tripId, next);
      if (result.error) setVisibilityError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">Preferences</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Shown as:</span>
          <div className="flex rounded-full border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => changeVisibility("public")}
              disabled={isPending}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !isPrivate ? "bg-ink text-cream" : "text-muted hover:text-ink"
              }`}
            >
              Names
            </button>
            <button
              type="button"
              onClick={() => changeVisibility("private")}
              disabled={isPending}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isPrivate ? "bg-ink text-cream" : "text-muted hover:text-ink"
              }`}
            >
              Anonymous
            </button>
          </div>
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted">
        A group decision, not a per-person one — whoever flips this changes
        it for everyone&rsquo;s answers, past and future.
      </p>
      {visibilityError && (
        <p className="text-sm text-red-700">{visibilityError}</p>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="participant_name" value={name} />
        <input type="hidden" name="participant_id" value={participantId ?? ""} />
        <textarea
          name="text"
          required
          rows={2}
          placeholder='e.g. "I can only do the first week of Oct" or "budget is $800 max"'
          className="rounded-xl border border-border bg-cream px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink disabled:opacity-50"
        >
          {pending ? "Reading…" : "Add"}
        </button>
      </form>

      {!unlocked ? (
        <p className="text-sm text-muted">
          Add your own preference to see what everyone else said — this keeps
          answers independent instead of anchored on each other.
        </p>
      ) : preferences.length === 0 ? (
        <p className="text-sm text-muted">No preferences logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {preferences.map((pref) => (
            <li
              key={pref.id}
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  {pref.category}
                </span>
                <span className="text-xs text-muted">{pref.type}</span>
              </div>
              <p className="mt-1.5 text-ink">{pref.value}</p>
              <p className="mt-1.5 text-xs text-muted">
                — {isPrivate ? "Anonymous" : pref.participants?.name ?? "Someone"}
                {!isPrivate && pref.source_text && (
                  <span className="italic"> · &quot;{pref.source_text}&quot;</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
