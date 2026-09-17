import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicWebhookUrl } from "@/lib/twilio/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { recordConsentEvent } from "@/lib/planner/consent";

/**
 * Twilio Messaging Service "Opt-Out Callback" — the reliable STOP/START
 * mechanism, since Advanced Opt-Out (on by default for a Messaging Service)
 * can intercept the keyword before it ever reaches the two message webhooks
 * (src/app/api/v2/twilio/route.ts, .../twilio/conversation/route.ts), which
 * only get a defensive, best-effort check. This URL has to be set manually
 * under the Messaging Service's Integration > Opt-Out Callback in the
 * Twilio console — nothing in code wires that up.
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

  const optOutType = (params.OptOutType ?? "").toUpperCase();
  const fromDigits = normalizePhoneDigits(params.From ?? "");
  if (!fromDigits || (optOutType !== "STOP" && optOutType !== "START")) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const user = await findPlannerUserByPhone(admin, fromDigits).catch(() => null);
  if (!user) return NextResponse.json({ ok: true });

  if (optOutType === "STOP") {
    await admin.from("planner_users").update({ notify_sms: false }).eq("id", user.id);
  } else {
    await recordConsentEvent(admin, user, "inbound_reply");
  }

  return NextResponse.json({ ok: true });
}
