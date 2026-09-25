import { describe, expect, it } from "vitest";
import { addMinutes } from "@/lib/planner/travel";

describe("addMinutes", () => {
  it("wraps around midnight instead of clamping to it", () => {
    // A 01:00 departure, suggested two hours early, is 23:00 the day
    // before — not 00:00 that same day.
    expect(addMinutes("01:00", -120)).toBe("23:00");
    expect(addMinutes("00:30", -60)).toBe("23:30");
  });

  it("still wraps forward past midnight", () => {
    expect(addMinutes("23:30", 45)).toBe("00:15");
  });

  it("leaves an in-range time alone", () => {
    expect(addMinutes("14:20", 10)).toBe("14:30");
  });
});
