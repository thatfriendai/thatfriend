import { describe, expect, it } from "vitest";
import { initialsOf, leadingChars } from "@/lib/planner/initials";
import { costsShareCurrency } from "@/lib/planner/stayComparison";
import { PEOPLE } from "../../qa/fixtures";

// A lone UTF-16 surrogate — what `"🦄"[0]` or a slice through an emoji gives.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("initials", () => {
  it("never splits an emoji into a broken surrogate half", () => {
    expect(initialsOf("🦄 Sam")).toBe("🦄S");
    expect(leadingChars("🦄 Sam")).toBe("🦄 ");
    expect(leadingChars("S🦄m")).toBe("S🦄");
    expect(initialsOf("🦄 Sam")).not.toMatch(LONE_SURROGATE);
    expect(leadingChars("S🦄m")).not.toMatch(LONE_SURROGATE);
    // The old code: "S🦄m".slice(0, 2) left half an emoji behind.
    expect("S🦄m".slice(0, 2)).toMatch(LONE_SURROGATE);
  });

  it("handles the fixture's accented, hyphenated, emoji-suffixed name", () => {
    const name = PEOPLE.unicodeName.name;
    expect(initialsOf(name)).toBe("ZN");
    expect(leadingChars(name)).toBe("ZO");
    expect(initialsOf(name)).not.toMatch(LONE_SURROGATE);
  });

  it("keeps a ZWJ emoji sequence and a combining accent together", () => {
    expect(leadingChars("👩‍👩‍👧 Family", 1)).toBe("👩‍👩‍👧");
    expect(initialsOf("émile zola")).toBe("ÉZ");
  });

  it("matches the old output for plain names and tolerates blanks", () => {
    expect(initialsOf("Ana Lima")).toBe("AL");
    expect(initialsOf("Ana Maria Lima")).toBe("AM");
    expect(initialsOf("  cher  ")).toBe("C");
    expect(initialsOf("")).toBe("");
    expect(leadingChars("jo")).toBe("JO");
  });
});

describe("costsShareCurrency", () => {
  const opt = (per_person_per_night: number | null, currency: string | null) => ({ per_person_per_night, currency });

  it("is true when every priced option uses the same currency", () => {
    expect(costsShareCurrency([opt(90, "EUR"), opt(95, "eur"), opt(120, "EUR ")])).toBe(true);
  });

  it("is false when priced options mix currencies", () => {
    expect(costsShareCurrency([opt(90, "EUR"), opt(95, "USD"), opt(120, "USD")])).toBe(false);
  });

  it("ignores options with no price or no currency set", () => {
    expect(costsShareCurrency([opt(90, "USD"), opt(95, null), opt(null, "EUR")])).toBe(true);
    expect(costsShareCurrency([])).toBe(true);
  });
});
