import "server-only";
import countries from "world-countries";

export interface CountryRef {
  /** ISO 3166-1 numeric code, zero-padded to 3 digits ("076") — matches world-atlas topojson feature ids exactly, which keep the leading zero as part of the id string rather than treating it as a number. */
  code: string;
  name: string;
  region: string;
}

const BY_CODE = new Map<string, CountryRef>();
const BY_NAME = new Map<string, string>();

for (const c of countries) {
  const code = c.ccn3;
  if (!code) continue;
  const ref: CountryRef = { code, name: c.name.common, region: c.region };
  BY_CODE.set(code, ref);
  for (const n of [c.name.common, c.name.official, ...(c.altSpellings ?? [])]) {
    const key = n.trim().toLowerCase();
    if (key && !BY_NAME.has(key)) BY_NAME.set(key, code);
  }
}

/**
 * Google's formatted addresses end with the country, in English, as their
 * own comma segment ("...Rua da Prata, Lisboa, Portugal"). That segment is
 * matched exactly against ISO country names and their common alt spellings
 * ("USA", "UK", "South Korea") — no fuzzy matching, since a wrong country
 * silently mis-places someone's trip on the map.
 */
export function countryFromAddress(address: string | null): CountryRef | null {
  if (!address) return null;
  const segments = address.split(",").map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  const code = BY_NAME.get(last.toLowerCase());
  return code ? (BY_CODE.get(code) ?? null) : null;
}

/** The continent for a numeric country code, used to count continents for a mixed set of rated and backfilled countries. */
export function regionForCode(code: string): string | null {
  return BY_CODE.get(code)?.region ?? null;
}

/**
 * Best-effort city guess from the same address — the segment before the
 * country, skipping anything that looks like a postal code or state
 * abbreviation ("FL 33101"). Callers should fall back to the trip's
 * destination text when this returns null.
 */
export function cityFromAddress(address: string | null): string | null {
  if (!address) return null;
  const segments = address.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = segments.length - 2; i >= 0; i--) {
    const seg = segments[i];
    if (!seg || /^\d/.test(seg) || /^[A-Z]{2}\s*\d/.test(seg)) continue;
    return seg;
  }
  return null;
}
