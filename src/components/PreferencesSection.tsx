"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitPreference } from "@/app/trip/[id]/actions";
import { useGuestIdentity } from "@/components/GuestIdentity";
import type { PreferenceWithParticipant } from "@/lib/supabase/types";

export function PreferencesSection({
  tripId,
  preferences,
}: {
  tripId: string;
  preferences: PreferenceWithParticipant[];
}) {
  const { name, participantId, setParticipantId } = useGuestIdentity();
  const [state, formAction, pending] = useActionState(submitPreference, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.participantId) setParticipantId(state.participantId);
    if (state?.success) formRef.current?.reset();
  }, [state, setParticipantId]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Preferences</h2>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="participant_name" value={name} />
        <input type="hidden" name="participant_id" value={participantId ?? ""} />
        <textarea
          name="text"
          required
          rows={2}
          placeholder='e.g. "I can only do the first week of Oct" or "budget is $800 max"'
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Reading…" : "Add"}
        </button>
      </form>

      {preferences.length === 0 ? (
        <p className="text-sm text-zinc-500">No preferences logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {preferences.map((pref) => (
            <li
              key={pref.id}
              className="rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {pref.category}
                </span>
                <span className="text-xs text-zinc-500">{pref.type}</span>
              </div>
              <p className="mt-1">{pref.value}</p>
              <p className="mt-1 text-xs text-zinc-500">
                — {pref.participants?.name ?? "Someone"}
                {pref.source_text && (
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
