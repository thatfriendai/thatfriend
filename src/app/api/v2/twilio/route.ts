import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadTwilioMedia, getPublicWebhookUrl } from "@/lib/twilio/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { addResourceFromWhatsAppText, addResourceFromWhatsAppImage } from "@/lib/planner/whatsappResource";

/**
 * Plain SMS/MMS webhook — handles anyone who isn't (yet) part of a trip's
 * group conversation. Twilio Conversations claims inbound messages from
 * known group participants before they ever reach this route (see
 * src/app/api/v2/twilio/conversation/route.ts); this only sees 1:1 DMs.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const publicUrl = getPublicWebhookUrl(request);

  if (!authToken || !twilio.validateRequest(authToken, signature, publicUrl, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const twiml = new twilio.twiml.MessagingResponse();
  const reply = (body: string) => {
    twiml.message(body);
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  };

  const fromDigits = normalizePhoneDigits(params.From ?? "");
  const body = (params.Body ?? "").trim();
  const numMedia = Number(params.NumMedia ?? "0");

  const admin = createAdminClient();
  let user: Awaited<ReturnType<typeof findPlannerUserByPhone>>;
  try {
    user = await findPlannerUserByPhone(admin, fromDigits);
  } catch {
    return reply("Something went wrong looking that up — try again in a bit.");
  }

  if (!user) {
    return reply(
      "Hi! I don't recognize this number yet. Sign in at the web app first — then text me anything and it'll land in your trip."
    );
  }

  const { data: membership } = await admin
    .from("planner_memberships")
    .select("trip_id, planner_trips(name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return reply("You're signed in, but you're not part of any trips yet.");
  }

  const tripName =
    (membership.planner_trips as unknown as { name: string } | null)?.name ?? "your trip";

  let result: Awaited<ReturnType<typeof addResourceFromWhatsAppText>> | null = null;

  if (numMedia > 0 && params.MediaUrl0) {
    try {
      const { base64, mimeType } = await downloadTwilioMedia(params.MediaUrl0);
      result = await addResourceFromWhatsAppImage(admin, membership.trip_id, user.id, base64, mimeType);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : "Could not download that image." };
    }
  } else if (body) {
    result = await addResourceFromWhatsAppText(admin, membership.trip_id, user.id, body);
  } else {
    return reply("I can only read text, links, and photos right now.");
  }

  if ("error" in result) {
    return reply(`Hmm, ${result.error}`);
  }

  if (result.places.length === 0) {
    if (result.duplicates.length > 0) {
      return reply(
        `Already on the map for "${tripName}": ${result.duplicates.join(", ")}.`
      );
    }
    return reply(`Didn't find any named places in that for "${tripName}".`);
  }

  const names = result.places.map((p) => p.name).join(", ");
  const dupNote =
    result.duplicates.length > 0
      ? ` (already had ${result.duplicates.join(", ")}.)`
      : "";
  return reply(
    `Added to "${tripName}": ${names}. ${result.places.length === 1 ? "It's" : "They're"} on the map now.${dupNote}`
  );
}
