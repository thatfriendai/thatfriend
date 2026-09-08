import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type InboundIntent =
  | { kind: "add_place" }
  | { kind: "question"; topic: "day" | "lodging_cost" | "other"; dayRef: string | null }
  | { kind: "nudge" }
  | { kind: "close_decision"; decisionRef: string | null };

const SYSTEM = `You classify one text message sent to "That Friend," a group trip-planning assistant, so it can be routed correctly. Most texts are someone forwarding a link, a note, or a caption for That Friend to save as a place on the trip — that's the default, "add_place", whenever the message isn't clearly a direct question or instruction addressed to the assistant itself. Only classify as something else when the message unambiguously reads as talking TO the assistant:
- "question": asking what's happening on a specific day (topic "day", with dayRef holding whatever they used to refer to it verbatim, e.g. "day 1", "tomorrow", "Saturday"), or asking about lodging/hotel/Airbnb cost (topic "lodging_cost"). Any other genuine question about the trip that isn't one of those two gets topic "other".
- "nudge": asking to remind, nudge, or ping the group or specific people about answering something.
- "close_decision": asking to close, finalize, or lock in a poll/decision/vote. decisionRef holds whatever they used to refer to which one, verbatim (e.g. "the hotel one", "where to eat"), or null if unspecified.
When genuinely unsure, prefer "add_place" — that's the safe default and matches almost all real traffic. Call record_intent.`;

interface RawIntent {
  kind?: string;
  topic?: string;
  dayRef?: string;
  decisionRef?: string;
}

function sanitize(input: RawIntent): InboundIntent {
  if (input.kind === "question") {
    const topic = input.topic === "day" || input.topic === "lodging_cost" ? input.topic : "other";
    const dayRef = typeof input.dayRef === "string" && input.dayRef.trim() ? input.dayRef.trim().slice(0, 60) : null;
    return { kind: "question", topic, dayRef };
  }
  if (input.kind === "nudge") return { kind: "nudge" };
  if (input.kind === "close_decision") {
    const decisionRef =
      typeof input.decisionRef === "string" && input.decisionRef.trim()
        ? input.decisionRef.trim().slice(0, 80)
        : null;
    return { kind: "close_decision", decisionRef };
  }
  return { kind: "add_place" };
}

/**
 * Classifies one inbound text before it reaches the "extract places and add
 * them" pipeline (src/lib/planner/whatsappResource.ts) — that pipeline stays
 * completely unchanged for anything this returns as "add_place", which is
 * the default whenever the message doesn't clearly read as a direct
 * question or command. Best-effort: on any failure, defaults to
 * "add_place" rather than risking a real forward getting swallowed.
 */
export async function classifyIntent(text: string): Promise<InboundIntent> {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "add_place" };

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: "user", content: trimmed.slice(0, 2000) }],
      tools: [
        {
          name: "record_intent",
          description: "Record how this message should be routed.",
          input_schema: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["add_place", "question", "nudge", "close_decision"],
              },
              topic: {
                type: "string",
                enum: ["day", "lodging_cost", "other"],
                description: "Only set when kind is 'question'.",
              },
              dayRef: {
                type: "string",
                description: "Only set when kind is 'question' and topic is 'day'.",
              },
              decisionRef: {
                type: "string",
                description: "Only set when kind is 'close_decision' and a specific one was named.",
              },
            },
            required: ["kind"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "record_intent" },
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return { kind: "add_place" };
    return sanitize(toolUse.input as RawIntent);
  } catch {
    return { kind: "add_place" };
  }
}
