import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type InboundIntent =
  | { kind: "add_place" }
  | { kind: "question"; topic: "day" | "lodging_cost" | "budget" | "roster" | "other"; dayRef: string | null }
  | { kind: "nudge" }
  | { kind: "close_decision"; decisionRef: string | null }
  | { kind: "start_trip"; destination: string | null; when: string | null }
  | { kind: "chat" };

export interface IntentContext {
  /** False for someone who isn't on any trip yet — a bare "lisbon in march" from them is a trip, not a place. */
  hasTrips: boolean;
}

const SYSTEM = `You classify one text message sent to "That Friend," a group trip-planning assistant, so it can be routed correctly. Most texts are someone forwarding a link, a note, or a caption for That Friend to save as a place on the trip — that's the default, "add_place", whenever the message isn't clearly a direct question or instruction addressed to the assistant itself. Only classify as something else when the message unambiguously reads as talking TO the assistant:
- "chat": a greeting, small talk, thanks, or a conversational reply that names no place, link, question, or instruction — e.g. "hey", "hi, first time using that friend", "thanks!", "lol ok", "just venting about my mom". Nothing here is meant to be saved.
- "question": asking what's happening on a specific day (topic "day", with dayRef holding whatever they used to refer to it verbatim, e.g. "day 1", "tomorrow", "Saturday"); asking specifically about the lodging/hotel/Airbnb decision or its price options (topic "lodging_cost", e.g. "how much is the airbnb", "what are the hotel options"); asking more generally whether the trip will be expensive or what to expect to spend, not tied to one specific decision (topic "budget", e.g. "is this going to be expensive", "what's our budget looking like", "worried about cost"); or asking whether everyone has joined/confirmed/answered (topic "roster", e.g. "did everyone confirm", "who's in", "is everyone here"). Any other genuine question about the trip that isn't one of those gets topic "other".
- "nudge": asking to remind, nudge, or ping the group or specific people about answering something.
- "close_decision": asking to close, finalize, or lock in a poll/decision/vote. decisionRef holds whatever they used to refer to which one, verbatim (e.g. "the hotel one", "where to eat"), or null if unspecified.
- "start_trip": asking to start, create, plan, or begin a brand-new trip (e.g. "start a trip to Lisbon", "new trip: Austin girls weekend", "let's plan a trip to Austin", "no idea yet, help me pick"). destination holds the place name verbatim as they wrote it, or null if they didn't name one (e.g. just "start a trip", or "help me pick"). when holds any timing they gave verbatim ("in March", "over thanksgiving", "next summer"), or null.
When the context line says the sender is on no trips yet, there is nothing to add a place TO — so a message that just names a destination or sketches a trip ("lisbon in march", "thinking tokyo w/ 3 friends", "somewhere warm in feb") is "start_trip", and a bare greeting is "chat". Otherwise, when genuinely unsure, prefer "add_place" — that's the safe default and matches almost all real traffic. Call record_intent.`;

interface RawIntent {
  kind?: string;
  topic?: string;
  dayRef?: string;
  decisionRef?: string;
  destination?: string;
  when?: string;
}

/** A verbatim field the model left empty — including when it spells "empty" as the string "null". */
function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(?:null|none|n\/a|undefined)$/i.test(trimmed)) return null;
  return trimmed.slice(0, max);
}

function sanitize(input: RawIntent): InboundIntent {
  if (input.kind === "question") {
    const topic =
      input.topic === "day" || input.topic === "lodging_cost" || input.topic === "budget" || input.topic === "roster"
        ? input.topic
        : "other";
    return { kind: "question", topic, dayRef: optionalText(input.dayRef, 60) };
  }
  if (input.kind === "nudge") return { kind: "nudge" };
  if (input.kind === "close_decision") {
    return { kind: "close_decision", decisionRef: optionalText(input.decisionRef, 80) };
  }
  if (input.kind === "start_trip") {
    return { kind: "start_trip", destination: optionalText(input.destination, 80), when: optionalText(input.when, 60) };
  }
  if (input.kind === "chat") return { kind: "chat" };
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
export async function classifyIntent(text: string, context: IntentContext = { hasTrips: true }): Promise<InboundIntent> {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "add_place" };

  // A greeting is the one thing worth catching without the model — it's
  // the very first text most people ever send, and if the API is down or
  // the key is bad the fallback below would otherwise route "hey" into
  // the place-extraction pipeline and answer with silence.
  if (
    /^(?:hey|hi|hello|yo|hiya|sup|hey there|hi there)[\s!.,]*(?:that friend[\s!.,]*)?$/i.test(trimmed) ||
    // The exact line the web app prefills for a first text (see
    // src/app/planner/home/TextItInBar.tsx), plus the obvious variants.
    /^(?:hey|hi|hello)?[\s,!.]*(?:(?:it'?s\s+)?(?:my\s+)?first time (?:using|on|with|trying) that friend|(?:i'?d like to |i want to |let'?s )?start texting with that friend)[\s!.,]*$/i.test(trimmed)
  ) {
    return { kind: "chat" };
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Context: the sender is ${context.hasTrips ? "already on at least one trip" : "on no trips yet"}.\n\nMessage:\n${trimmed.slice(0, 2000)}`,
        },
      ],
      tools: [
        {
          name: "record_intent",
          description: "Record how this message should be routed.",
          input_schema: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["add_place", "question", "nudge", "close_decision", "start_trip", "chat"],
              },
              topic: {
                type: "string",
                enum: ["day", "lodging_cost", "budget", "roster", "other"],
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
              destination: {
                type: "string",
                description: "Only set when kind is 'start_trip' and a place was named.",
              },
              when: {
                type: "string",
                description: "Only set when kind is 'start_trip' and they said when, verbatim.",
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
