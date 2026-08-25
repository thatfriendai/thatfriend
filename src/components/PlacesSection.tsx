"use client";

import { useActionState, useEffect, useState } from "react";
import { addPlace } from "@/app/trip/[id]/actions";
import { useGuestIdentity } from "@/components/GuestIdentity";
import { PlaceSearch, type SelectedPlace } from "@/components/PlaceSearch";
import { PlaceMap } from "@/components/PlaceMap";
import { PlaceNotes } from "@/components/PlaceNotes";
import type { PlaceWithParticipant } from "@/lib/supabase/types";

export function PlacesSection({
  tripId,
  places,
  googleMapsApiKey,
}: {
  tripId: string;
  places: PlaceWithParticipant[];
  googleMapsApiKey: string;
}) {
  const { name, participantId, setParticipantId } = useGuestIdentity();
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [state, formAction, pending] = useActionState(addPlace, null);

  useEffect(() => {
    if (state?.participantId) setParticipantId(state.participantId);
    // Clears the in-progress selection once the server action confirms the
    // place was saved — selected is independent client state, not derivable
    // from state/props alone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state?.success) setSelected(null);
  }, [state, setParticipantId]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl text-ink">Places</h2>

      <PlaceSearch apiKey={googleMapsApiKey} onSelect={setSelected} />

      {selected && (
        <form
          action={formAction}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <input type="hidden" name="trip_id" value={tripId} />
          <input type="hidden" name="participant_name" value={name} />
          <input type="hidden" name="participant_id" value={participantId ?? ""} />
          <input type="hidden" name="name" value={selected.name} />
          <input type="hidden" name="address" value={selected.address} />
          <input type="hidden" name="lat" value={selected.lat} />
          <input type="hidden" name="lng" value={selected.lng} />
          <input type="hidden" name="category" value={selected.category} />
          <p className="font-display text-lg text-ink">{selected.name}</p>
          <p className="-mt-2 text-xs text-muted">{selected.address}</p>
          {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add to trip"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full border border-border px-5 py-2.5 text-sm text-ink hover:bg-cream"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <PlaceMap apiKey={googleMapsApiKey} places={places} />
        {places.length === 0 ? (
          <p className="text-sm text-muted">No places added yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {places.map((place) => (
              <li
                key={place.id}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-sm"
              >
                <p className="font-display text-lg text-ink">{place.name}</p>
                {place.address && (
                  <p className="text-xs text-muted">{place.address}</p>
                )}
                <p className="mt-1.5 text-xs text-muted">
                  Added by {place.participants?.name ?? "Someone"}
                </p>
                <PlaceNotes
                  tripId={tripId}
                  placeId={place.id}
                  notes={place.place_notes}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
