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

/** How long a phone's "active trip" SMS-routing context lasts without another message before it's treated as expired. */
export const ACTIVE_TRIP_WINDOW_HOURS = 24;

/** Shortest date-overlap window worth proposing. 1 = single days are proposable; the tie-break already prefers longer windows on an equal score, so this doesn't crowd them out. */
export const MIN_DATE_WINDOW = 1;

/** How many times a transient (network/5xx) email-invite send failure is retried before giving up. Permanent failures (bad address) never retry. */
export const MAX_EMAIL_RETRIES = 2;

/** How long after a nudge (web button, cron, or the "nudge" SMS intent — any of them) before another one for the same trip+stage is allowed. A spam guard, not a product cap anyone should ever cheerfully hit. */
export const NUDGE_COOLDOWN_HOURS = 24;
