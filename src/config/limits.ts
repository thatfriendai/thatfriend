/**
 * Every hard-coded product limit, in one place. Previously scattered as
 * local constants across the route/lib files that enforced them — see
 * docs/qa/KNOWN_ISSUES.md, P2-3, for the full list of what moved here and
 * from where.
 */

/** Longest trip we accept — a guard against typos like 2026 → 2062, not a product limit anyone should hit. */
export const MAX_TRIP_DAYS = 60;

/** Longest a trip name can be. */
export const MAX_TRIP_NAME_LENGTH = 120;

/** How many availability marks one person can have on a trip. */
export const MAX_AVAILABILITY_MARKS = 366;

/** How many places get confirmed from a single forwarded link/screenshot — extras are dropped silently. */
export const MAX_PLACES_PER_CONFIRM = 12;

/** How many options a decision can hold in total — whether given all at once at creation or added one at a time afterward. */
export const MAX_OPTIONS_PER_DECISION = 10;

/** How many people can be on one trip at once. Comfortably fits a 20-25 person reunion. */
export const MAX_TRAVELERS_PER_TRIP = 30;

/** How many stay (lodging) decisions one trip can have open at once. */
export const MAX_STAYS_PER_TRIP = 10;
