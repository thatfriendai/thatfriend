"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateParticipant } from "@/lib/participants";
import { extractPreferences } from "@/lib/claude/extract-preference";

interface ActionResult {
  error?: string;
  success?: boolean;
  participantId?: string;
}

export async function submitPreference(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const tripId = String(formData.get("trip_id") ?? "");
  const participantName = String(formData.get("participant_name") ?? "").trim();
  const existingParticipantId =
    (formData.get("participant_id") as string) || null;
  const text = String(formData.get("text") ?? "").trim();

  if (!tripId) return { error: "Missing trip." };
  if (!participantName) return { error: "Enter your name first." };
  if (!text) return { error: "Type a message first." };

  const admin = createAdminClient();

  let participantId: string;
  try {
    participantId = await getOrCreateParticipant(
      admin,
      tripId,
      participantName,
      existingParticipantId
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not identify you." };
  }

  let extracted;
  try {
    extracted = await extractPreferences(text);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not process that message.",
      participantId,
    };
  }

  if (extracted.length === 0) {
    return {
      error: "Couldn't find a preference in that message — try rephrasing.",
      participantId,
    };
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

  if (error) return { error: error.message, participantId };

  revalidatePath(`/trip/${tripId}`);
  return { success: true, participantId };
}

export async function addPlace(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const tripId = String(formData.get("trip_id") ?? "");
  const participantName = String(formData.get("participant_name") ?? "").trim();
  const existingParticipantId =
    (formData.get("participant_id") as string) || null;
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const category = String(formData.get("category") ?? "").trim();

  if (!tripId) return { error: "Missing trip." };
  if (!participantName) return { error: "Enter your name first." };
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Pick a place from the search results." };
  }

  const admin = createAdminClient();

  let participantId: string;
  try {
    participantId = await getOrCreateParticipant(
      admin,
      tripId,
      participantName,
      existingParticipantId
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not identify you." };
  }

  const { error } = await admin.from("places").insert({
    trip_id: tripId,
    name,
    address: address || null,
    lat,
    lng,
    category: category || null,
    added_by: participantId,
  });

  if (error) return { error: error.message, participantId };

  revalidatePath(`/trip/${tripId}`);
  return { success: true, participantId };
}
