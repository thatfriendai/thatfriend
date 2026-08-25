import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Trip,
  PreferenceWithParticipant,
  PlaceWithParticipant,
} from "@/lib/supabase/types";
import { GuestIdentityProvider } from "@/components/GuestIdentity";
import { PreferencesSection } from "@/components/PreferencesSection";
import { PlacesSection } from "@/components/PlacesSection";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle<Trip>();

  if (!trip) notFound();

  const { data: preferences } = await admin
    .from("preferences")
    .select("*, participants(id, name, role)")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })
    .returns<PreferenceWithParticipant[]>();

  const { data: places } = await admin
    .from("places")
    .select(
      "*, participants(id, name, role), place_notes(*, participants(id, name, role))"
    )
    .eq("trip_id", id)
    .order("created_at", { ascending: false })
    .returns<PlaceWithParticipant[]>();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 bg-cream px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl text-ink">{trip.name}</h1>
        {trip.target_dates && <p className="text-muted">{trip.target_dates}</p>}
        <div>
          <CopyLinkButton />
        </div>
      </div>

      <GuestIdentityProvider tripId={trip.id}>
        <PreferencesSection
          tripId={trip.id}
          preferences={preferences ?? []}
          visibility={trip.preferences_visibility}
        />
        <PlacesSection
          tripId={trip.id}
          places={places ?? []}
          googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        />
      </GuestIdentityProvider>
    </div>
  );
}
