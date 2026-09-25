import { describe, expect, it } from "vitest";
import { computeDecisionOutcome } from "@/lib/planner/decisionOutcome";

const opt = (id: string, label: string, count: number) => ({ id, label, count });

describe("computeDecisionOutcome (P2-2: tied votes)", () => {
  it("picks the clear leader when there's no tie", () => {
    const result = computeDecisionOutcome([opt("a", "A", 3), opt("b", "B", 1)]);
    expect(result).toEqual({ isTied: false, decidedOptionId: "a", leaders: [opt("a", "A", 3)] });
  });

  it("is a tie, not a silent first-listed win, when two options share the top count", () => {
    const result = computeDecisionOutcome([opt("a", "A", 2), opt("b", "B", 2), opt("c", "C", 1)]);
    expect(result.isTied).toBe(true);
    expect(result.decidedOptionId).toBeNull();
    expect(result.leaders.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("names every option in a three-way tie, not just two", () => {
    const result = computeDecisionOutcome([opt("a", "A", 4), opt("b", "B", 4), opt("c", "C", 4)]);
    expect(result.isTied).toBe(true);
    expect(result.leaders.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("still resolves to the first-listed option when nobody voted at all", () => {
    const result = computeDecisionOutcome([opt("a", "A", 0), opt("b", "B", 0)]);
    expect(result).toEqual({ isTied: false, decidedOptionId: "a", leaders: [opt("a", "A", 0), opt("b", "B", 0)] });
  });

  it("handles a single option (no possible tie)", () => {
    const result = computeDecisionOutcome([opt("a", "A", 5)]);
    expect(result).toEqual({ isTied: false, decidedOptionId: "a", leaders: [opt("a", "A", 5)] });
  });
});
