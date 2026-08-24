/**
 * Placeholder — swap this out for the real extraction system prompt.
 * Whatever prompt you use, keep it returning JSON shaped like
 * ExtractedPreference (src/lib/claude/extract-preference.ts) since
 * extractPreference() parses the response against that shape.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You extract structured trip-planning preferences from a short message written by someone joining a group trip.

Given the message, call the \`record_preference\` tool with:
- category: one of "Dates", "Budget", "Location", "Activity", "Veto" — whichever best fits the message
- type: "Preference" (a soft want), "Constraint" (a hard requirement), or "Veto" (a hard no)
- value: a short, normalized restatement of the preference (e.g. "first week of October", "$800 max per person")

If the message contains more than one distinct preference, just extract the most prominent one.`;
