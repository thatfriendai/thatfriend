import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractedLodgingOption {
  label: string;
  option_type: string | null;
  price_per_person_night: number | null;
  total_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sharing_note: string | null;
  amenities: { label: string; available: boolean }[];
  neighborhood: string | null;
  location_note: string | null;
}

const SYSTEM = `You pull structured lodging details out of a listing page's text (Airbnb, hotel booking site, aparthotel, etc.) for a group trip planning tool. Call record_lodging_option with whatever the page actually states — leave a field null rather than guessing. price_per_person_night and total_price are for the whole stay described on the page (assume the group size and night count implied by the listing; if unclear, leave null). amenities should list the handful of amenities a group deciding between places would care about (kitchen, AC, washer, pool, parking, wifi) with available true/false based on what the listing says — omit amenities the listing doesn't mention either way. sharing_note is a short one-line description of the sleeping arrangement (e.g. "3 bedrooms, 2 baths" or "one bathroom for six" if notably cramped). location_note is a short one-line note about the location if the listing gives one (walkability, distance to a landmark).`;

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
            option_type: { type: "string", description: "e.g. \"Airbnb · Entire home\", \"Hotel · 3 doubles\"." },
            price_per_person_night: { type: ["number", "null"] },
            total_price: { type: ["number", "null"] },
            bedrooms: { type: ["integer", "null"] },
            bathrooms: { type: ["integer", "null"] },
            sharing_note: { type: ["string", "null"] },
            amenities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  available: { type: "boolean" },
                },
                required: ["label", "available"],
              },
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

  const input = toolUse.input as Partial<ExtractedLodgingOption> & { label?: string };
  if (!input.label || typeof input.label !== "string") return null;

  return {
    label: input.label.trim().slice(0, 120),
    option_type: input.option_type ?? null,
    price_per_person_night: input.price_per_person_night ?? null,
    total_price: input.total_price ?? null,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    sharing_note: input.sharing_note ?? null,
    amenities: Array.isArray(input.amenities) ? input.amenities : [],
    neighborhood: input.neighborhood ?? null,
    location_note: input.location_note ?? null,
  };
}
