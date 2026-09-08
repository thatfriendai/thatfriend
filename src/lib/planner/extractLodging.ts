import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { StayAmenities, StaySource } from "@/lib/supabase/planner-types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AMENITY_KEYS = ["kitchen", "ac", "washer", "pool", "breakfast", "wifi"] as const;
const SOURCE_VALUES: StaySource[] = ["airbnb", "hotel", "aparthotel", "other"];

export interface ExtractedLodgingOption {
  label: string;
  source: StaySource | null;
  total_cost: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds_note: string | null;
  amenities: StayAmenities;
  neighborhood: string | null;
  location_note: string | null;
}

const SYSTEM = `You pull structured lodging details out of a listing page's text (Airbnb, hotel booking site, aparthotel, etc.) for a group trip planning tool. Call record_lodging_option with whatever the page actually states — leave a field null rather than guessing. source is which kind of listing this is. total_cost is for the whole stay described on the page, with currency as a 3-letter code (e.g. USD, EUR) if stated. For each amenity key (kitchen, ac, washer, pool, breakfast, wifi), set true or false only if the listing actually says so either way — leave a key out entirely if it's not mentioned at all; never guess. beds_note is a short one-line description of the sleeping arrangement (e.g. "3 bedrooms, 2 baths" or "one bathroom for six" if notably cramped). location_note is a short one-line note about the location if the listing gives one (walkability, distance to a landmark).`;

export async function extractLodgingOption(pageText: string): Promise<ExtractedLodgingOption | null> {
  const trimmed = pageText.trim().slice(0, 8000);
  if (!trimmed) return null;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 800,
    system: SYSTEM,
    messages: [{ role: "user", content: trimmed }],
    tools: [
      {
        name: "record_lodging_option",
        description: "Record the lodging option's details found on the page.",
        input_schema: {
          type: "object",
          properties: {
            label: { type: "string", description: "The listing's name/title." },
            source: { type: "string", enum: SOURCE_VALUES },
            total_cost: { type: ["number", "null"] },
            currency: { type: ["string", "null"] },
            bedrooms: { type: ["integer", "null"] },
            bathrooms: { type: ["integer", "null"] },
            beds_note: { type: ["string", "null"] },
            amenities: {
              type: "object",
              properties: Object.fromEntries(AMENITY_KEYS.map((k) => [k, { type: "boolean" }])),
            },
            neighborhood: { type: ["string", "null"] },
            location_note: { type: ["string", "null"] },
          },
          required: ["label"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_lodging_option" },
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const input = toolUse.input as Partial<ExtractedLodgingOption> & {
    label?: string;
    amenities?: Partial<Record<string, boolean>>;
  };
  if (!input.label || typeof input.label !== "string") return null;

  const amenities: StayAmenities = { kitchen: null, ac: null, washer: null, pool: null, breakfast: null, wifi: null };
  for (const key of AMENITY_KEYS) {
    const v = input.amenities?.[key];
    if (typeof v === "boolean") amenities[key] = v;
  }

  return {
    label: input.label.trim().slice(0, 120),
    source: SOURCE_VALUES.includes(input.source as StaySource) ? (input.source as StaySource) : null,
    total_cost: input.total_cost ?? null,
    currency: input.currency ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    beds_note: input.beds_note ?? null,
    amenities,
    neighborhood: input.neighborhood ?? null,
    location_note: input.location_note ?? null,
  };
}
