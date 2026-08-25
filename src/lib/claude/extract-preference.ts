import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_SYSTEM_PROMPT } from "./extraction-prompt";
import type { PreferenceCategory, PreferenceType } from "@/lib/supabase/types";

const CATEGORIES: PreferenceCategory[] = [
  "Dates",
  "Budget",
  "Location",
  "Activity",
  "Veto",
];
const TYPES: PreferenceType[] = ["Preference", "Constraint", "Veto"];

export interface ExtractedPreference {
  category: PreferenceCategory;
  type: PreferenceType;
  value: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractPreferences(
  sourceText: string
): Promise<ExtractedPreference[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: sourceText }],
    tools: [
      {
        name: "record_preferences",
        description:
          "Record every distinct structured preference extracted from the message.",
        input_schema: {
          type: "object",
          properties: {
            preferences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string", enum: CATEGORIES },
                  type: { type: "string", enum: TYPES },
                  value: { type: "string" },
                },
                required: ["category", "type", "value"],
              },
            },
          },
          required: ["preferences"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_preferences" },
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured preferences.");
  }

  const input = toolUse.input as { preferences?: unknown };
  if (!Array.isArray(input.preferences)) {
    throw new Error("Claude did not return a preferences list.");
  }

  return input.preferences.map((item, index) => {
    const entry = item as Record<string, unknown>;
    const category = entry.category as string;
    const type = entry.type as string;
    const value = entry.value as string;

    if (!CATEGORIES.includes(category as PreferenceCategory)) {
      throw new Error(`Unexpected category from Claude at index ${index}: ${category}`);
    }
    if (!TYPES.includes(type as PreferenceType)) {
      throw new Error(`Unexpected type from Claude at index ${index}: ${type}`);
    }

    return {
      category: category as PreferenceCategory,
      type: type as PreferenceType,
      value,
    };
  });
}
