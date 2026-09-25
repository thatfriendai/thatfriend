import "server-only";
import { Resend } from "resend";
import { MAX_EMAIL_RETRIES } from "@/config/limits";

/**
 * A real send attempt failed or the provider isn't configured — the
 * caller decides "failed" vs. "bounced"/retry from this, not a guess.
 * "config" means don't retry at all: no key is never going to resolve
 * itself on the next attempt.
 */
export type SendEmailError = { kind: "config" | "transient" | "permanent"; message: string };

let client: Resend | null | undefined;

/** Lazily constructed so a missing key doesn't throw at module load, only at send time — matches this app's other providers. */
function getClient(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY;
  client = apiKey ? new Resend(apiKey) : null;
  return client;
}

const FROM = process.env.RESEND_FROM_EMAIL || "That Friend <invites@thatfriend.co>";

/**
 * Sends the "you're invited to <trip>" email. Never fakes success: a
 * missing API key or a real provider error both come back as a typed
 * failure the caller can act on (retry, mark failed, tell the organizer),
 * never a silent no-op — see P1-A in docs/qa/KNOWN_ISSUES.md for why this
 * exists.
 */
export async function sendInviteEmail(
  to: string,
  organizerName: string,
  tripName: string,
  joinUrl: string
): Promise<{ ok: true; id: string } | { ok: false; error: SendEmailError }> {
  const resend = getClient();
  if (!resend) {
    return {
      ok: false,
      error: { kind: "config", message: "RESEND_API_KEY is not set — cannot send invite emails." },
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject: `${organizerName} invited you to ${tripName}`,
      text: `${organizerName} invited you to join ${tripName} on That Friend.\n\n${joinUrl}\n\nIf you weren't expecting this, you can ignore it.`,
      html: `<p>${escapeHtml(organizerName)} invited you to join <strong>${escapeHtml(tripName)}</strong> on That Friend.</p><p><a href="${joinUrl}">${joinUrl}</a></p><p style="color:#8C8478;font-size:13px;">If you weren't expecting this, you can ignore it.</p>`,
    });
    if (error) {
      // Resend's SDK returns { error } rather than throwing for provider-
      // reported failures (bad address, rate limit, etc.) — the ones worth
      // distinguishing for a retry are rate limits and 5xx-shaped ones;
      // everything else about the address itself is permanent.
      const transient = /rate.?limit|timeout|5\d\d/i.test(error.message ?? error.name ?? "");
      return { ok: false, error: { kind: transient ? "transient" : "permanent", message: error.message } };
    }
    return { ok: true, id: data!.id };
  } catch (e) {
    // A thrown error here is a network/infra failure, not the provider
    // rejecting the address — worth retrying.
    return { ok: false, error: { kind: "transient", message: e instanceof Error ? e.message : "Unknown error" } };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type SendResult = { ok: true; id: string } | { ok: false; error: SendEmailError };

/**
 * Retries a transient failure (network/5xx) up to MAX_EMAIL_RETRIES times;
 * a permanent one (bad address) or a config problem (no API key) fails on
 * the first attempt, since trying again can't change either. `send` is
 * injected so this orchestration is testable without touching the real
 * Resend SDK.
 */
export async function sendWithRetry(
  send: (attempt: number) => Promise<SendResult>
): Promise<{ status: "sent" | "failed"; error: string | null; attempts: number }> {
  let lastError: string | null = null;
  for (let attempt = 0; attempt <= MAX_EMAIL_RETRIES; attempt++) {
    const result = await send(attempt);
    if (result.ok) return { status: "sent", error: null, attempts: attempt + 1 };
    lastError = result.error.message;
    if (result.error.kind !== "transient") return { status: "failed", error: lastError, attempts: attempt + 1 };
  }
  return { status: "failed", error: lastError, attempts: MAX_EMAIL_RETRIES + 1 };
}
