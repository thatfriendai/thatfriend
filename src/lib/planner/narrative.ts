import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ConvergenceOverlap, ClusterCount } from "./convergence";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface NarrativeRead {
  head: string;
  body: string;
}

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
  const summary = {
    overlaps: overlaps.map((o) => ({
      label: o.label,
      floor: o.floor,
      worksForMost: o.comfy,
      spread: o.dots.map((d) => d.value),
    })),
    interests: clusters.map((c) => `${c.label}: ${c.count} of ${c.total}`),
    nonNegotiables,
  };

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
