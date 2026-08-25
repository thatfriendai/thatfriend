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
    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1">
          {sorted.map((note) => (
            <li key={note.id} className="text-xs text-ink/70">
              <span className="font-medium text-ink">
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
          className="flex-1 rounded-full border border-border bg-cream px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
    </div>
  );
}
