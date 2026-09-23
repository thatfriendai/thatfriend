import { describe, expect, it } from "vitest";
import { computeDateProposal } from "@/lib/planner/dates";
import { PEOPLE } from "../../qa/fixtures";

const marks = (userId: string, dates: string[]) => dates.map((date) => ({ user_id: userId, date }));

describe("computeDateProposal", () => {
  it("returns nothing when nobody has marked dates", () => {
    expect(computeDateProposal([], 4)).toEqual({ proposal: null, coverage: [] });
  });

  it("covers every day of the marked span exactly once, in order", () => {
    const { coverage } = computeDateProposal(
      [...marks("a", ["2026-10-09", "2026-10-12"]), ...marks("b", ["2026-10-10"])],
      2
    );
    expect(coverage.map((d) => d.date)).toEqual(["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]);
  });

  it("picks the window everyone can make over a longer partial one", () => {
    const all = ["2026-11-06", "2026-11-07", "2026-11-08"];
    const { proposal } = computeDateProposal(
      [
        ...marks(PEOPLE.organizer.id, [...all, "2026-11-09", "2026-11-10"]),
        ...marks(PEOPLE.flaky.id, all),
        ...marks(PEOPLE.international.id, [...all, "2026-11-09"]),
      ],
      3
    );
    expect(proposal).toMatchObject({ start_date: "2026-11-06", end_date: "2026-11-08", score: 3, label: "works for all 3" });
  });

  it("says 'N of M' when no window works for the whole group", () => {
    const { proposal } = computeDateProposal(
      [...marks("a", ["2026-12-04", "2026-12-05"]), ...marks("b", ["2026-12-04", "2026-12-05"])],
      5
    );
    expect(proposal?.label).toBe("works for 2 of 5");
  });

  it("counts a person once per day even if their mark was saved twice", () => {
    const { coverage } = computeDateProposal([...marks("a", ["2026-10-09", "2026-10-09", "2026-10-10"])], 1);
    expect(coverage).toEqual([
      { date: "2026-10-09", count: 1 },
      { date: "2026-10-10", count: 1 },
    ]);
  });

  it("needs at least two consecutive days to propose anything", () => {
    const { proposal } = computeDateProposal(marks("a", ["2026-10-09", "2026-10-15"]), 1);
    expect(proposal).toBeNull();
  });

  it("never proposes more than 10 days", () => {
    const days = Array.from({ length: 20 }, (_, i) => `2027-01-${String(i + 1).padStart(2, "0")}`);
    const { proposal } = computeDateProposal(marks("a", days), 1);
    expect(proposal?.start_date).toBe("2027-01-01");
    expect(proposal?.end_date).toBe("2027-01-10");
  });

  it.each([
    ["month boundary", ["2026-10-30", "2026-10-31", "2026-11-01"]],
    ["year boundary", ["2026-12-30", "2026-12-31", "2027-01-01"]],
    ["leap day", ["2028-02-28", "2028-02-29", "2028-03-01"]],
    ["US DST end", ["2026-10-31", "2026-11-01", "2026-11-02"]],
    ["EU DST start", ["2027-03-27", "2027-03-28", "2027-03-29"]],
  ])("keeps calendar dates intact across a %s", (_label, days) => {
    const { proposal, coverage } = computeDateProposal(marks("a", days), 1);
    expect(coverage.map((d) => d.date)).toEqual(days);
    expect(proposal).toMatchObject({ start_date: days[0], end_date: days[days.length - 1] });
  });
});
