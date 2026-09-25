import { describe, expect, it } from "vitest";
import { addDays, dateRange, daysBetween, todayIn } from "@/lib/planner/calendarDate";
import { TRIPS } from "../../qa/fixtures";

describe("calendarDate", () => {
  it("dateRange is inclusive and empty when end is before start", () => {
    expect(dateRange("2026-10-16", "2026-10-18")).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(dateRange("2026-10-24", "2026-10-24")).toEqual(["2026-10-24"]);
    expect(dateRange("2026-10-18", "2026-10-16")).toEqual([]);
  });

  it("addDays crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("daysBetween is a whole number across DST changes", () => {
    const { start_date, end_date } = TRIPS.dstWeekend;
    expect(daysBetween(start_date, end_date)).toBe(3);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
  });

  it.each(Object.entries(TRIPS).filter(([, t]) => t.start_date && t.end_date))(
    "%s trip has one entry per night + 1",
    (_key, trip) => {
      const days = dateRange(trip.start_date!, trip.end_date!);
      expect(days[0]).toBe(trip.start_date);
      expect(days[days.length - 1]).toBe(trip.end_date);
      expect(days.length).toBe(daysBetween(trip.start_date!, trip.end_date!) + 1);
      expect(new Set(days).size).toBe(days.length);
    }
  );
});

describe("todayIn", () => {
  // 01:30 UTC on Oct 17 is still the evening of Oct 16 in the Americas.
  const now = new Date("2026-10-17T01:30:00Z");
  it.each([
    ["America/Los_Angeles", "2026-10-16"],
    ["America/New_York", "2026-10-16"],
    ["Europe/Istanbul", "2026-10-17"],
    ["UTC", "2026-10-17"],
    ["Not/AZone", "2026-10-17"],
  ])("%s -> %s", (tz, expected) => expect(todayIn(tz, now)).toBe(expected));
});

describe("formatDateRange", () => {
  it("shows a day trip as one date, not 'Oct 24–24'", async () => {
    const { formatDateRange } = await import("@/lib/planner/calendarDate");
    expect(formatDateRange("2026-10-24", "2026-10-24")).toBe("Oct 24");
    expect(formatDateRange("2026-10-16", "2026-10-18")).toBe("Oct 16–18");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("Dec 30–Jan 2");
  });
});
