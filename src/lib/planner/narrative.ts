import "server-only";
import { unstable_cache } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import type { ConvergenceOverlap, ClusterCount } from "./convergence";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NarrativeRead {
  head: string;
  body: string;
}

interface ConvergenceSummary {
  overlaps: { label: string; floor: number; worksForMost: number; spread: number[] }[];
  interests: string[];
  nonNegotiables: string[];
}

/**
 * Both the Convergence page and its API route call this whenever there's
 * overlap data — a live Anthropic call previously re-run on every view,
 * even when nobody's answered anything new since the last one. Cached on
 * exactly the aggregated summary the prompt reads, so repeat views of an
 * unchanged trip reuse the same reads, and a real change (someone submits
 * preferences) naturally produces a different cache key instead of a
 * stale read.
 */
async function readsFromSummary(tripName: string, summary: ConvergenceSummary): Promise<NarrativeRead[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 600,
    system: `You write short, direct "here's the shape of it" reads for a group trip planning tool, based on aggregated budget and interest data for the trip "${tripName}". Each read is one plain-spoken observation about what the numbers actually mean for planning — never generic encouragement. Match this tone exactly: "Accommodation is the constraint, not activities." / "Not flights. Sam and Jonas top out at $80 a night, and Tom is at $160. A villa split six ways is the only shape that clears both." Call record_reads with 2-4 entries.`,
    messages: [{ role: "user", content: JSON.stringify(summary) }],
    tools: [
      {
        name: "record_reads",
        description: "Record the short interpretive reads for the convergence screen.",
        input_schema: {
          type: "object",
          properties: {
            reads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  head: { type: "string", description: "A short headline, 3-6 words" },
                  body: { type: "string", description: "One or two plain sentences" },
                },
                required: ["head", "body"],
              },
            },
          },
          required: ["reads"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_reads" },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return [];

  const input = toolUse.input as { reads?: NarrativeRead[] };
  return Array.isArray(input.reads) ? input.reads : [];
}

const cachedReadsFromSummary = unstable_cache(readsFromSummary, ["convergence-reads"], { revalidate: 3600 });

/**
 * The "write the short reads on the convergence screen" job from the spec
 * — e.g. "Accommodation is the constraint, not activities." Takes only
 * the aggregated stats, never raw per-person text, so it stays cheap and
 * can't leak anything a private trip is hiding.
 */
export async function generateConvergenceReads(
  tripName: string,
  overlaps: ConvergenceOverlap[],
  clusters: ClusterCount[],
  nonNegotiables: string[]
): Promise<NarrativeRead[]> {
  const summary: ConvergenceSummary = {
    overlaps: overlaps.map((o) => ({
      label: o.label,
      floor: o.floor,
      worksForMost: o.comfy,
      spread: o.dots.map((d) => d.value),
    })),
    interests: clusters.map((c) => `${c.label}: ${c.count} of ${c.total}`),
    nonNegotiables,
  };

  return cachedReadsFromSummary(tripName, summary);
}
