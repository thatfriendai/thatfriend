import "server-only";
import { randomBytes, randomInt } from "node:crypto";

/** URL-safe random token for invite/join links. */
export function generateToken() {
  return randomBytes(24).toString("base64url");
}

// Excludes visually ambiguous characters (0/O, 1/I/L) — this gets read off
// a phone screen and retyped, not copy-pasted.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * A short, textable join code — "LISBON4K" style. `destination` gives it a
 * human-readable prefix (falls back to "TRIP" if there isn't one); a random
 * 3-character suffix keeps it unique across trips that share a city.
 */
export function generateJoinCode(destination: string | null): string {
  const cityPart =
    (destination ?? "")
      .split(",")[0]
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 10) || "TRIP";
  let suffix = "";
  for (let i = 0; i < 3; i++) suffix += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return `${cityPart}${suffix}`;
}
