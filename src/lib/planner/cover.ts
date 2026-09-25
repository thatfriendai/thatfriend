// City → short airport/stamp code, matching the design's postmark badge.
// Falls back to deriving 4 letters from the name for anything not listed.
const STAMPS: Record<string, string> = {
  Sardinia: "OLBIA",
  "New York": "JFK",
  Istanbul: "IST",
  London: "LHR",
  "Greek Islands": "ATH",
  Lisbon: "LIS",
  Miami: "MIA",
  Tokyo: "HND",
  CDMX: "MEX",
  "Mexico City": "MEX",
  Gardiner: "NY",
  Marrakech: "RAK",
  Paris: "CDG",
  Rome: "FCO",
  Barcelona: "BCN",
};

export function stampFor(place: string): string {
  return STAMPS[place] || place.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
}

export function stripeFor(tint: string): string {
  return `repeating-linear-gradient(45deg, ${tint} 0 11px, #FBF7EF 11px 22px, #A83A2E 22px 33px, #FBF7EF 33px 44px)`;
}

// Cycled per real trip (no category to tint by, unlike a guide's type).
// #A9709A (mauve) is darkened to #985B88, same as DAY_COLORS in
// itinerary.ts — it's used both as text and (with cream text on top of it)
// as a button background, and was 3.5-3.8:1 either way, below AA.
export const COVER_TINTS = ["#8A5A7A", "#6E5A7A", "#985B88", "#5E5A6E", "#7A5A6E"];

export function tintFor(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return COVER_TINTS[Math.abs(h) % COVER_TINTS.length];
}
