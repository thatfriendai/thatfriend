import { NextResponse } from "next/server";
import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicWebhookUrl } from "@/lib/twilio/client";
import { normalizePhoneDigits } from "@/lib/planner/phone";
import { findPlannerUserByPhone } from "@/lib/planner/plannerUser";
import { applyOptKeyword } from "@/lib/planner/consent";

/**
 * Mirrors a STOP/START that Twilio's Advanced Opt-Out already handled,
 * delivered with OptOutType set. The Messaging Service's inbound webhook
 * should point at src/app/api/v2/twilio/route.ts (see
 * scripts/configure-twilio-webhooks.mjs), which handles OptOutType itself
 * AND every ordinary text — this route is kept as a safe target only: it
 * answers nothing, so if the console is ever pointed here again by
 * mistake, ordinary texts would be silently dropped, not mis-answered.
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

  await applyOptKeyword(admin, user, optOutType === "STOP" ? "stop" : "start");

  return NextResponse.json({ ok: true });
}
