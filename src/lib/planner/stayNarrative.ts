import "server-only";
import { unstable_cache } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import type { StayComparison } from "./stayComparison";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface StayReadSummaryRow {
  label: string;
  per_person_per_night: number | null;
  bathrooms: number | null;
  walk_minutes: number | null;
  rating: number | null;
  vote_count: number;
  best_in: string[];
}

/**
 * The trip page calls this on every load whenever a stay decision exists —
 * a live Anthropic call sitting in that page's render path, previously
 * re-run on every single view even when nothing about the options or votes
 * had changed since the last one. Cached on exactly the fields the prompt
 * below actually reads (not the raw StayComparison, which also carries
 * photo/URL/etc. that don't affect the sentence) — so the same comparison
 * state reuses the same read, and a real change (a new vote, a new option)
 * naturally produces a different cache key instead of a stale sentence.
 */
async function readFromSummary(tripName: string, summary: StayReadSummaryRow[]): Promise<string | null> {
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      system: `You write one short, direct sentence naming the actual tradeoff between accommodation options for the trip "${tripName}" — never generic encouragement, never inventing a number that isn't in the data given. Match this tone: "The Bairro Alto flat is $20/person/night more, but it's the only one with two bathrooms." / "Everyone's voted for the cheapest option — there's no real tradeoff here." Call record_read.`,
      messages: [{ role: "user", content: JSON.stringify(summary) }],
      tools: [
        {
          name: "record_read",
          description: "Record the one-sentence tradeoff read.",
          input_schema: {
            type: "object",
            properties: { sentence: { type: "string" } },
            required: ["sentence"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_read" },
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const input = toolUse.input as { sentence?: string };
    return typeof input.sentence === "string" ? input.sentence.trim() || null : null;
  } catch {
    return null;
  }
}

const cachedReadFromSummary = unstable_cache(readFromSummary, ["stay-read"], { revalidate: 3600 });

/**
 * One-sentence "here's the actual tradeoff" line for the bottom of the
 * accommodation comparison table — same job and tone as
 * generateConvergenceReads in narrative.ts, just for a different screen.
 * Built from the derived comparison data only (cheapest vs. best-rated vs.
 * most-voted vs. anything that clears a constraint the others miss) —
 * never invents a price or amenity that isn't in the data.
 */
export async function generateStayRead(
  tripName: string,
  comparison: StayComparison
): Promise<string | null> {
  if (comparison.options.length < 2) return null;

  const summary: StayReadSummaryRow[] = comparison.options.map((o) => ({
    label: o.label,
    per_person_per_night: o.per_person_per_night,
    bathrooms: o.bathrooms,
    walk_minutes: o.walk_minutes,
    rating: o.rating,
    vote_count: o.votes.length,
    best_in: o.best_in,
  }));

  return cachedReadFromSummary(tripName, summary);
}
