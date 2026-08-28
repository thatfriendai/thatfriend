/** Digits only, no "+" — the form Meta's Cloud API sends/expects on the wire. */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}
