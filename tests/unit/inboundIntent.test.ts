import { describe, expect, it, vi } from "vitest";

// The model is only a fallback for the greeting fast-path under test here —
// make any accidental call obvious rather than slow and billed.
const create = vi.fn(async () => {
  throw new Error("model should not be called for this input");
});
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));

const { classifyIntent } = await import("@/lib/planner/inboundIntent");

describe("classifyIntent without the model", () => {
  it.each([
    "hey",
    "Hi!",
    "hello that friend",
    "hey there",
    "hi, it's my first time using That Friend",
    "I'd like to start texting with That Friend",
  ])("greets %j without a model call", async (text) => {
    create.mockClear();
    expect(await classifyIntent(text)).toEqual({ kind: "chat", tone: "greeting" });
    expect(create).not.toHaveBeenCalled();
  });

  it("treats empty/whitespace as the safe default", async () => {
    expect(await classifyIntent("   ")).toEqual({ kind: "add_place" });
  });

  it("falls back to add_place when the model errors, so a real forward is never swallowed", async () => {
    expect(await classifyIntent("https://maps.app.goo.gl/abc123")).toEqual({ kind: "add_place" });
  });
});
