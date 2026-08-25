import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPreferences, type ExtractedPreference } from "@/lib/claude/extract-preference";

/**
 * Runs a free-text message through Claude extraction and inserts the
 * resulting rows. Shared by the web form action and the WhatsApp webhook so
 * both paths log preferences identically.
 */
export async function logPreferencesFromText(
  admin: SupabaseClient,
  tripId: string,
  participantId: string,
  text: string
): Promise<{ error: string } | { extracted: ExtractedPreference[] }> {
  let extracted: ExtractedPreference[];
  try {
    extracted = await extractPreferences(text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not process that message." };
  }

  if (extracted.length === 0) {
    return { error: "Couldn't find a preference in that message — try rephrasing." };
  }

  const { error } = await admin.from("preferences").insert(
    extracted.map((pref) => ({
      trip_id: tripId,
      participant_id: participantId,
      category: pref.category,
      value: pref.value,
      type: pref.type,
      source_text: text,
    }))
  );

  if (error) return { error: error.message };

  return { extracted };
}
