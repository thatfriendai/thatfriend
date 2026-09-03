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
