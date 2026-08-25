"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateParticipant } from "@/lib/participants";
import { logPreferencesFromText } from "@/lib/preferences";
import { createTwilioClient, getWhatsAppFrom, toWhatsAppAddress } from "@/lib/twilio/client";
import type { PreferencesVisibility } from "@/lib/supabase/types";

interface ActionResult {
  error?: string;
  success?: boolean;
  participantId?: string;
}

export async function setPreferencesVisibility(
  tripId: string,
  visibility: PreferencesVisibility
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("trips")
    .update({ preferences_visibility: visibility })
    .eq("id", tripId);

  if (error) return { error: error.message };

  revalidatePath(`/trip/${tripId}`);
  return {};
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

  const result = await logPreferencesFromText(admin, tripId, participantId, text);
  if ("error" in result) return { error: result.error, participantId };

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

export async function addPlaceNote(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const tripId = String(formData.get("trip_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const participantName = String(formData.get("participant_name") ?? "").trim();
  const existingParticipantId =
    (formData.get("participant_id") as string) || null;
  const text = String(formData.get("text") ?? "").trim();

  if (!tripId || !placeId) return { error: "Missing place." };
  if (!participantName) return { error: "Enter your name first." };
  if (!text) return { error: "Write a note first." };

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

  const { error } = await admin.from("place_notes").insert({
    trip_id: tripId,
    place_id: placeId,
    participant_id: participantId,
    text,
  });

  if (error) return { error: error.message, participantId };

  revalidatePath(`/trip/${tripId}`);
  return { success: true, participantId };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function generateConnectCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

interface ConnectCodeResult {
  error?: string;
  participantId?: string;
  code?: string;
  phoneNumber?: string | null;
}

/** Gets (or creates) this participant's WhatsApp link code, or reports the
 * phone number they're already connected with. */
export async function getWhatsAppConnectCode(
  tripId: string,
  participantName: string,
  existingParticipantId: string | null
): Promise<ConnectCodeResult> {
  if (!participantName.trim()) return { error: "Enter your name first." };

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

  const { data: participant } = await admin
    .from("participants")
    .select("phone_number")
    .eq("id", participantId)
    .maybeSingle();

  if (participant?.phone_number) {
    return { participantId, phoneNumber: participant.phone_number };
  }

  const { data: existingCode } = await admin
    .from("whatsapp_connect_codes")
    .select("code")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingCode) return { participantId, code: existingCode.code };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateConnectCode();
    const { error } = await admin
      .from("whatsapp_connect_codes")
      .insert({ trip_id: tripId, participant_id: participantId, code });

    if (!error) return { participantId, code };
    // Unique violation on `code` — regenerate and retry; any other error bails out.
    if (error.code !== "23505") return { error: error.message, participantId };
  }

  return { error: "Could not generate a code — try again.", participantId };
}

/** Sends a WhatsApp reminder to everyone connected but not yet answered. */
export async function sendNudges(
  tripId: string
): Promise<{ error?: string; sentCount?: number }> {
  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("trips")
    .select("name")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { error: "Trip not found." };

  const { data: participants, error: participantsError } = await admin
    .from("participants")
    .select("id, name, phone_number")
    .eq("trip_id", tripId)
    .not("phone_number", "is", null);
  if (participantsError) return { error: participantsError.message };
  if (!participants || participants.length === 0) {
    return { error: "Nobody has connected WhatsApp yet." };
  }

  const { data: answered } = await admin
    .from("preferences")
    .select("participant_id")
    .eq("trip_id", tripId);
  const answeredIds = new Set((answered ?? []).map((p) => p.participant_id));

  const toNudge = participants.filter((p) => !answeredIds.has(p.id));
  if (toNudge.length === 0) {
    return { error: "Everyone connected has already answered." };
  }

  let client: ReturnType<typeof createTwilioClient>;
  let from: string;
  try {
    client = createTwilioClient();
    from = getWhatsAppFrom();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "WhatsApp isn't configured yet." };
  }

  let sentCount = 0;

  for (const participant of toNudge) {
    try {
      await client.messages.create({
        from,
        to: toWhatsAppAddress(participant.phone_number as string),
        body: `Hey ${participant.name.split(" ")[0]}! Still need your preferences for "${trip.name}" — reply here with your dates, budget, or anything you'd rule out.`,
      });
      sentCount++;
    } catch {
      // Keep nudging the rest of the group even if one number fails
      // (e.g. they haven't opted in / sandbox not joined).
    }
  }

  if (sentCount === 0) {
    return { error: "Couldn't send any nudges — check your Twilio setup." };
  }

  return { sentCount };
}
