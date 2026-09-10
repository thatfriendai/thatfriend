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
