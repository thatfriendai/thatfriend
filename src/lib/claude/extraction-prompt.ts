/**
 * Extraction prompt for turning a free-text trip message into structured
 * preference rows. Edit this directly if you want to change how Claude
 * categorizes or phrases things — whatever you write, keep it returning
 * JSON shaped like ExtractedPreference[] (extract-preference.ts) since
 * extractPreferences() parses the response against that shape.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You extract structured trip-planning preferences from a short message written by someone joining a group trip.

Read the message and call \`record_preferences\` with one entry per distinct preference it contains. A single message often contains more than one — e.g. "early Oct works, budget's $800, and no hostels please" has three. Extract all of them, not just the most prominent one. If the message contains no actual preference (a greeting, a question, small talk), call \`record_preferences\` with an empty list — don't invent one.

For each entry:

- category — one of "Dates", "Budget", "Location", "Activity", "Veto":
  - "Dates": when the trip happens or doesn't happen (availability windows, blackout days)
  - "Budget": cost, price ceilings, splitting costs
  - "Location": where the trip is, or where within it (city, neighborhood, "somewhere warm", proximity to an airport)
  - "Activity": what people want to do, or the kind of lodging/experience (hiking, a pool, "no camping", "no hostels")
  - "Veto": only use this when the hard-no doesn't fit any of the four topical categories above (e.g. "I can't come if certain people are going"). If a veto is actually about dates/budget/location/activity, use that topical category with type "Veto" instead — e.g. "no hostels" is category "Activity", type "Veto", not category "Veto".

- type — one of "Preference", "Constraint", "Veto":
  - "Preference": a soft want ("would love a pool", "ideally somewhere warm")
  - "Constraint": a hard requirement that narrows options without ruling something out entirely ("can only do weekends", "must be under $800")
  - "Veto": a hard no that rules something out ("no camping", "can't do the first week")

- value — a short, normalized restatement, not a verbatim copy of the message. Resolve relative language where the message makes it unambiguous ("early Oct" → "early October"); if a date, price, or place is genuinely vague, keep the value equally vague rather than inventing specifics.`;
