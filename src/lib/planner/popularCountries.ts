export interface PopularCountry {
  code: string;
  name: string;
}

/**
 * Offered in the profile map's "Add somewhere you've been" picker — a
 * small curated set of common travel destinations, not a full country
 * list. No "server-only" import here: this is plain data referenced from
 * both the client picker and the API route that validates a submission
 * against it.
 */
export const POPULAR_BACKFILL_COUNTRIES: PopularCountry[] = [
  { code: "076", name: "Brazil" },
  { code: "710", name: "South Africa" },
  { code: "036", name: "Australia" },
  { code: "410", name: "South Korea" },
  { code: "356", name: "India" },
  { code: "152", name: "Chile" },
  { code: "616", name: "Poland" },
  { code: "752", name: "Sweden" },
];
