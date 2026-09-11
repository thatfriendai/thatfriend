/** Digits only, no "+" — a transport-agnostic form for comparing phone numbers. */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

/**
 * Best-effort E.164 (Twilio requires a leading "+" on every number it's
 * asked to send to). A bare 10-digit number is assumed US/Canada, since
 * that's this app's only market so far — not a full phone-parsing library.
 */
export function toE164(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/**
 * Only US numbers can text with That Friend right now — Twilio bills
 * international SMS at materially higher per-message rates, and by
 * default a Twilio account's geographic permissions allow sending to most
 * countries, so nothing on Twilio's side stops an international number
 * from going through and being charged for. Gate it here instead: a
 * 10-digit local number is always assumed US (same assumption toE164
 * already makes), and an explicit "+" country code must be +1.
 */
export function isUSPhone(phone: string): boolean {
  const e164 = toE164(phone);
  return /^\+1\d{10}$/.test(e164);
}

/**
 * Human-readable form of a stored E.164 number, e.g. "+14155550100" ->
 * "+1 (415) 555-0100". Only US/Canada gets special-cased formatting, same
 * as toE164's own assumption — any other country code is shown as-is
 * rather than guessing at a format that doesn't apply to it.
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const last = digits.slice(7, 11);
    return `+1 (${area}) ${mid}-${last}`;
  }
  return phone;
}
