import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParticipantRole } from "@/lib/supabase/types";

/**
 * Looks up a participant by id (fast path, once the browser has cached one
 * in localStorage) or by trip_id + name, creating one if neither exists.
 * Guests self-identify by name only — there's no auth backing this, so two
 * people typing the same name on the same trip become the same participant.
 */
export async function getOrCreateParticipant(
  admin: SupabaseClient,
  tripId: string,
  name: string,
  existingParticipantId: string | null,
  role: ParticipantRole = "guest"
): Promise<string> {
  if (existingParticipantId) {
    const { data } = await admin
      .from("participants")
      .select("id")
      .eq("id", existingParticipantId)
      .eq("trip_id", tripId)
      .maybeSingle();
    if (data) return data.id;
  }

  const trimmedName = name.trim();

  const { data: existingByName } = await admin
    .from("participants")
    .select("id")
    .eq("trip_id", tripId)
    .eq("name", trimmedName)
    .maybeSingle();
  if (existingByName) return existingByName.id;

  const { data: created, error } = await admin
    .from("participants")
    .insert({ trip_id: tripId, name: trimmedName, role })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create participant.");
  }

  return created.id;
}
