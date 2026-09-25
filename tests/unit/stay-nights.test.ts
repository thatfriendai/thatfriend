import { describe, expect, it } from "vitest";
import { stayNightsFromDates, outsideTripRangeWarning } from "@/lib/planner/calendarDate";

describe("stayNightsFromDates (P2-5: nights derived from check-in/check-out)", () => {
  it("derives the night count from a valid check-in/check-out pair", () => {
    expect(stayNightsFromDates("2026-10-09", "2026-10-13")).toEqual({ nights: 4, error: null });
  });

  it("is fine with both left blank — nights stays unset, no error", () => {
    expect(stayNightsFromDates("", "")).toEqual({ nights: null, error: null });
    expect(stayNightsFromDates(undefined, undefined)).toEqual({ nights: null, error: null });
  });

  it("rejects giving only one of the two dates", () => {
    expect(stayNightsFromDates("2026-10-09", "")).toEqual({
      nights: null,
      error: "Give both a check-in and a check-out date, or leave both blank.",
    });
    expect(stayNightsFromDates("", "2026-10-13")).toEqual({
      nights: null,
      error: "Give both a check-in and a check-out date, or leave both blank.",
    });
  });

  it("rejects a check-out on or before check-in", () => {
    expect(stayNightsFromDates("2026-10-13", "2026-10-13")).toEqual({
      nights: null,
      error: "Check-out has to be after check-in.",
    });
    expect(stayNightsFromDates("2026-10-13", "2026-10-09")).toEqual({
      nights: null,
      error: "Check-out has to be after check-in.",
    });
  });

  it("rejects a fake calendar date", () => {
    expect(stayNightsFromDates("2026-02-30", "2026-03-05")).toEqual({
      nights: null,
      error: "Those dates don't look right.",
    });
  });

  it("holds across a month boundary and DST without drifting a day", () => {
    expect(stayNightsFromDates("2026-10-30", "2026-11-02")).toEqual({ nights: 3, error: null });
  });
});

describe("outsideTripRangeWarning", () => {
  it("warns when the stay starts before the trip does", () => {
    expect(outsideTripRangeWarning("2026-10-08", "2026-10-12", "2026-10-09", "2026-10-15")).toMatch(
      /falls outside the trip's own dates/
    );
  });

  it("warns when the stay ends after the trip does", () => {
    expect(outsideTripRangeWarning("2026-10-10", "2026-10-20", "2026-10-09", "2026-10-15")).toMatch(
      /falls outside the trip's own dates/
    );
  });

  it("is null when the stay fits inside the trip's dates", () => {
    expect(outsideTripRangeWarning("2026-10-10", "2026-10-12", "2026-10-09", "2026-10-15")).toBeNull();
  });

  it("is null when the trip has no dates locked yet — nothing to compare against", () => {
    expect(outsideTripRangeWarning("2026-10-10", "2026-10-12", null, null)).toBeNull();
  });
});
