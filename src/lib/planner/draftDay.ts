import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface UnscheduledPlace {
  id: string;
  name: string;
  kind: string;
  note: string | null;
  savedBy: string | null;
}

export interface ScheduledDaySummary {
  date: string;
  city: string | null;
  placeNames: string[];
}

export interface DayDraft {
  placeIds: string[];
  reasoning: string;
}

const SYSTEM = `You draft one day of a group trip's itinerary for a trip planning tool. You're given the day's date/city, the trip's saved-but-not-yet-scheduled places, and a summary of how other days are already shaped. Pick a sensible subset of the unscheduled places for THIS day (2-5 places is typical — don't overpack a day) that make sense together (same neighborhood, logical order, a reasonable pace), and write one short sentence explaining the grouping — a real reason a person would find useful (geography, pacing, saving something for later in the week), not generic filler. If nothing unscheduled fits this day well, pick the best available few anyway; you must call the tool with at least one place unless the unscheduled list is empty, in which case call it with an empty list and a reasoning explaining there's nothing to draft with yet.`;

export async function draftDayItinerary(
  dayDate: string,
  dayCity: string | null,
  unscheduled: UnscheduledPlace[],
  scheduledDays: ScheduledDaySummary[],
  excludePlaceIds: string[] = []
): Promise<DayDraft | null> {
  const candidates = unscheduled.filter((p) => !excludePlaceIds.includes(p.id));
  if (candidates.length === 0) return { placeIds: [], reasoning: "Nothing saved and unscheduled to draft with yet." };

  const placesList = candidates
    .map((p) => `- [${p.id}] ${p.name} (${p.kind})${p.note ? ` — ${p.note}` : ""}${p.savedBy ? ` — saved by ${p.savedBy}` : ""}`)
    .join("\n");
  const otherDays = scheduledDays
    .filter((d) => d.placeNames.length > 0)
    .map((d) => `- ${d.date}${d.city ? ` (${d.city})` : ""}: ${d.placeNames.join(", ")}`)
    .join("\n");

  const userContent = `Day to draft: ${dayDate}${dayCity ? ` in ${dayCity}` : ""}${excludePlaceIds.length > 0 ? "\n\n(A previous draft for this day used different places — try a different combination this time.)" : ""}

Unscheduled saved places:
${placesList}

Other days already planned:
${otherDays || "(none yet)"}`;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
    tools: [
      {
        name: "draft_day",
        description: "Record the drafted day.",
        input_schema: {
          type: "object",
          properties: {
            place_ids: {
              type: "array",
              items: { type: "string" },
              description: "Ordered ids of the chosen places, from the bracketed ids in the unscheduled list.",
            },
            reasoning: { type: "string", description: "One sentence explaining the grouping." },
          },
          required: ["place_ids", "reasoning"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "draft_day" },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const input = toolUse.input as { place_ids?: unknown; reasoning?: unknown };
  const validIds = new Set(candidates.map((p) => p.id));
  const placeIds = Array.isArray(input.place_ids)
    ? input.place_ids.filter((id): id is string => typeof id === "string" && validIds.has(id))
    : [];
  const reasoning = typeof input.reasoning === "string" ? input.reasoning.trim().slice(0, 300) : "";

  return { placeIds, reasoning };
}
