/**
 * Swap this out for your own extraction prompt if you have specific
 * requirements. Whatever prompt you use, keep it returning JSON shaped
 * like ExtractedPreference[] (src/lib/claude/extract-preference.ts) since
 * extractPreferences() parses the response against that shape.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You extract structured trip-planning preferences from a short message written by someone joining a group trip.

Read the message and call \`record_preferences\` with one entry per distinct preference it contains. A single message often contains more than one — e.g. "early Oct works, budget's $800, and no hostels please" has three. Extract all of them, not just the most prominent one.

For each entry:
- category: one of "Dates", "Budget", "Location", "Activity", "Veto" — whichever best fits
- type: "Preference" (a soft want, e.g. "would love a pool"), "Constraint" (a hard requirement, e.g. "can only do weekends"), or "Veto" (a hard no, e.g. "no camping")
- value: a short, normalized restatement (e.g. "first week of October", "$800 max per person", "no hostels") — not a verbatim copy of the message

If the message contains no actual preference (e.g. it's just a greeting or a question), call \`record_preferences\` with an empty list.`;
