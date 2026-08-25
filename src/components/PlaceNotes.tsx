"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPlaceNote } from "@/app/trip/[id]/actions";
import { useGuestIdentity } from "@/components/GuestIdentity";
import type { PlaceNoteWithParticipant } from "@/lib/supabase/types";

export function PlaceNotes({
  tripId,
  placeId,
  notes,
}: {
  tripId: string;
  placeId: string;
  notes: PlaceNoteWithParticipant[];
}) {
  const { name, participantId, setParticipantId } = useGuestIdentity();
  const [state, formAction, pending] = useActionState(addPlaceNote, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.participantId) setParticipantId(state.participantId);
    if (state?.success) formRef.current?.reset();
  }, [state, setParticipantId]);

  const sorted = [...notes].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((note) => (
            <li key={note.id} className="text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">
                {note.participants?.name ?? "Someone"}:
              </span>{" "}
              {note.text}
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex gap-2">
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="place_id" value={placeId} />
        <input type="hidden" name="participant_name" value={name} />
        <input type="hidden" name="participant_id" value={participantId ?? ""} />
        <input
          type="text"
          name="text"
          required
          placeholder="Add a note or paste a link…"
          className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}
