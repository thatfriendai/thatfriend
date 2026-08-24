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

export async function extractPreference(
  sourceText: string
): Promise<ExtractedPreference> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: sourceText }],
    tools: [
      {
        name: "record_preference",
        description: "Record one structured preference extracted from the message.",
        input_schema: {
          type: "object",
          properties: {
            category: { type: "string", enum: CATEGORIES },
            type: { type: "string", enum: TYPES },
            value: { type: "string" },
          },
          required: ["category", "type", "value"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "record_preference" },
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured preference.");
  }

  const input = toolUse.input as Record<string, unknown>;
  const category = input.category as string;
  const type = input.type as string;
  const value = input.value as string;

  if (!CATEGORIES.includes(category as PreferenceCategory)) {
    throw new Error(`Unexpected category from Claude: ${category}`);
  }
  if (!TYPES.includes(type as PreferenceType)) {
    throw new Error(`Unexpected type from Claude: ${type}`);
  }

  return {
    category: category as PreferenceCategory,
    type: type as PreferenceType,
    value,
  };
}
