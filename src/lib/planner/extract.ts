import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { KIND_OPTIONS } from "./itinerary";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractedPlace {
  name: string;
  kind: string;
  note: string;
}

const KIND_NAMES: string[] = KIND_OPTIONS.map((k) => k.kind);

const SYSTEM = `You pull out real, named places (restaurants, bars, museums, activities, viewpoints, shops — anything a group might visit or eat at) from pasted text or a screenshot for a group trip planning tool. Ignore anything that isn't a specific named place — flight numbers, dates on their own, generic advice. For each place, write a short note (one sentence, under 120 characters) with whatever practical detail is present (booking advice, price, why it's worth it) — if the source gives none, write a plain one-line description instead of inventing detail. Guess the closest kind from: ${KIND_NAMES.join(", ")}. Call record_places with what you find, up to 12 places. If there's nothing usable, call it with an empty list.`;

async function runExtraction(
  content: Anthropic.MessageParam["content"]
): Promise<ExtractedPlace[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: "user", content }],
    tools: [
      {
        name: "record_places",
        description: "Record the places found in the source.",
        input_schema: {
          type: "object",
          properties: {
            places: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  kind: { type: "string", enum: KIND_NAMES },
                  note: { type: "string" },
                },
                required: ["name", "kind", "note"],
              },
            },
          },
          required: ["places"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_places" },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return [];

  const input = toolUse.input as { places?: ExtractedPlace[] };
  if (!Array.isArray(input.places)) return [];

  return input.places
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .map((p) => ({
      name: p.name.trim().slice(0, 120),
      kind: KIND_NAMES.includes(p.kind) ? p.kind : "Other",
      note: typeof p.note === "string" ? p.note.trim().slice(0, 200) : "",
    }))
    .slice(0, 12);
}

export async function extractPlacesFromText(text: string): Promise<ExtractedPlace[]> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return [];
  return runExtraction(trimmed);
}

export async function extractPlacesFromImage(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<ExtractedPlace[]> {
  return runExtraction([
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    },
    { type: "text", text: "Find the places in this screenshot." },
  ]);
}
