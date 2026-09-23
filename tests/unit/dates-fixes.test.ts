import { describe, expect, it } from "vitest";
import {
  formatDateRange,
  isValidCalendarDate,
  MAX_MARKS,
  MAX_TRIP_DAYS,
  sanitizeMarkDates,
  tripRangeError,
} from "@/lib/planner/calendarDate";
import { computeDateProposal, earliestProposableDate, upcomingMarks } from "@/lib/planner/dates";
import { inTripRange } from "@/lib/planner/days";
import { PEOPLE } from "../../qa/fixtures";

describe("isValidCalendarDate", () => {
  it("accepts real dates, including leap days", () => {
    expect(isValidCalendarDate("2026-09-23")).toBe(true);
    expect(isValidCalendarDate("2028-02-29")).toBe(true);
  });

  it("rejects dates that only have the right shape", () => {
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-09-00"]) {
      expect(isValidCalendarDate(bad)).toBe(false);
    }
  });

  it("rejects non-strings and other formats", () => {
    for (const bad of [null, undefined, 20260923, "2026-9-23", "2026-09-23T00:00:00Z", ""]) {
      expect(isValidCalendarDate(bad)).toBe(false);
    }
  });
});

describe("tripRangeError", () => {
  it("accepts a normal range and a single-day trip", () => {
    expect(tripRangeError("2026-10-09", "2026-10-12")).toBeNull();
    expect(tripRangeError("2026-10-09", "2026-10-09")).toBeNull();
  });

  it("rejects impossible dates, a reversed range and missing dates", () => {
    expect(tripRangeError("2026-02-30", "2026-03-02")).not.toBeNull();
    expect(tripRangeError("2026-10-12", "2026-10-09")).not.toBeNull();
    expect(tripRangeError(null, "2026-10-09")).not.toBeNull();
  });

  it(`caps a trip at ${MAX_TRIP_DAYS} days, inclusive`, () => {
    expect(tripRangeError("2026-10-01", "2026-11-29")).toBeNull(); // 60 days
    expect(tripRangeError("2026-10-01", "2026-11-30")).toMatch(/at most/); // 61 days
    expect(tripRangeError("2026-10-01", "2062-10-01")).toMatch(/at most/);
  });
});

describe("sanitizeMarkDates", () => {
  const today = "2026-09-23";

  it("keeps real dates, deduped, and drops junk", () => {
    expect(sanitizeMarkDates(["2026-10-09", "2026-10-09", "2026-02-30", 5, "nope", "2026-10-10"], today)).toEqual([
      "2026-10-09",
      "2026-10-10",
    ]);
  });

  it("treats a missing or non-array body as no marks", () => {
    expect(sanitizeMarkDates(undefined, today)).toEqual([]);
    expect(sanitizeMarkDates("2026-10-09", today)).toEqual([]);
  });

  it("drops dates far outside a plausible window", () => {
    expect(sanitizeMarkDates(["1999-01-01", "2030-01-01", "2027-06-01"], today)).toEqual(["2027-06-01"]);
  });

  it(`refuses more than ${MAX_MARKS} dates`, () => {
    const many = Array.from({ length: MAX_MARKS + 1 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 1) + i * 86_400_000);
      return d.toISOString().slice(0, 10);
    });
    expect(sanitizeMarkDates(many, today)).toBeNull();
    expect(sanitizeMarkDates(many.slice(0, MAX_MARKS), today)).toHaveLength(MAX_MARKS);
  });
});

describe("formatDateRange", () => {
  it("names the end month only when it differs from the start's", () => {
    const cross = formatDateRange("2026-09-28", "2026-10-03");
    const same = formatDateRange("2026-09-03", "2026-09-08");
    const oct = new Date(Date.UTC(2026, 9, 3)).toLocaleDateString(undefined, { timeZone: "UTC", month: "short" });
    const sep = new Date(Date.UTC(2026, 8, 3)).toLocaleDateString(undefined, { timeZone: "UTC", month: "short" });
    expect(cross).toContain(oct);
    expect(cross).toContain(sep);
    expect(same.split(sep)).toHaveLength(2); // month appears once
  });

  it("uses the given separator", () => {
    expect(formatDateRange("2026-09-03", "2026-09-08", { separator: " – " })).toContain(" – ");
  });
});

describe("upcomingMarks / earliestProposableDate", () => {
  it("allows yesterday as slack for the server's UTC clock", () => {
    expect(earliestProposableDate(new Date("2026-09-23T12:00:00Z"))).toBe("2026-09-22");
  });

  it("stops past days from driving the proposal", () => {
    const marks = [
      // Everyone was free last week…
      ...["2026-09-10", "2026-09-11", "2026-09-12"].flatMap((date) => [
        { user_id: PEOPLE.organizer.id, date },
        { user_id: PEOPLE.flaky.id, date },
      ]),
      // …but only one person is free from here on.
      { user_id: PEOPLE.organizer.id, date: "2026-10-09" },
      { user_id: PEOPLE.organizer.id, date: "2026-10-10" },
    ];
    const upcoming = upcomingMarks(marks, "2026-09-22");
    expect(upcoming.every((m) => m.date >= "2026-09-22")).toBe(true);
    expect(computeDateProposal(upcoming, 2).proposal).toMatchObject({ start_date: "2026-10-09", end_date: "2026-10-10" });
  });
});

describe("inTripRange", () => {
  it("drops days left over from an earlier date range", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-20"].map((date) => ({
      date,
    }));
    expect(inTripRange(days, "2026-10-09", "2026-10-11").map((d) => d.date)).toEqual([
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });
});
