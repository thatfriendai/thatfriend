import "server-only";
import { addDays, dateRange, todayIn } from "./calendarDate";
import { MIN_DATE_WINDOW } from "@/config/limits";

const MAX_WINDOW = 10;
const PREFERRED_MIN_WINDOW = 2;

interface Window {
  start: number;
  len: number;
  score: number;
  sum: number;
}

/**
 * The best window of `minLen`–MAX_WINDOW days: scored by its weakest day,
 * ties broken by length and then total coverage. Null when no window has
 * anyone free.
 */
function bestWindow(coverage: DateCoverageDay[], minLen: number): Window | null {
  let best: Window | null = null;
  for (let start = 0; start < coverage.length; start++) {
    let minCount = Infinity;
    let sum = 0;
    for (let len = 1; len <= MAX_WINDOW && start + len <= coverage.length; len++) {
      const count = coverage[start + len - 1].count;
      minCount = Math.min(minCount, count);
      sum += count;
      if (len < minLen) continue;

      const candidate = { start, len, score: minCount, sum };
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && candidate.len > best.len) ||
        (candidate.score === best.score && candidate.len === best.len && candidate.sum > best.sum)
      ) {
        best = candidate;
      }
    }
  }
  return best && best.score > 0 ? best : null;
}

export interface DateProposal {
  start_date: string;
  end_date: string;
  score: number;
  label: string;
}

export interface DateCoverageDay {
  date: string;
  count: number;
}

/**
 * The earliest date a proposal (or a lock) may start on: yesterday, by the
 * server's clock. A day of slack because the server's "today" is UTC —
 * already tomorrow for someone in the Americas in the evening — and a
 * proposal that starts a few hours in the past is harmless, whereas one
 * built on last month's marks is not.
 */
export function earliestProposableDate(now: Date = new Date()): string {
  return addDays(todayIn(undefined, now), -1);
}

/**
 * Only the marks that can still become a trip. Days that have passed would
 * otherwise keep scoring — a group that marked last weekend would be
 * proposed last weekend — so they're dropped before computeDateProposal.
 */
export function upcomingMarks<T extends { date: string }>(marks: T[], earliest: string): T[] {
  return marks.filter((m) => m.date >= earliest);
}

/**
 * Every contiguous window of 2-10 days within the marked span is scored by
 * its weakest day (a stretch is only as good as the day fewest people can
 * make), then the highest-scoring window wins — longer windows and higher
 * total coverage break ties. A single day is proposed only when it gets
 * more people there than any 2+ day stretch — by two or more, in groups of
 * 4 or more. Mirrors convergence's floor/comfy language:
 * a full-coverage window "works for all N", otherwise "works for N of M".
 */
export function computeDateProposal(
  marks: { user_id: string; date: string }[],
  totalMembers: number
): { proposal: DateProposal | null; coverage: DateCoverageDay[] } {
  if (marks.length === 0) return { proposal: null, coverage: [] };

  const dates = marks.map((m) => m.date).sort();
  const spanStart = dates[0];
  const spanEnd = dates[dates.length - 1];
  const span = dateRange(spanStart, spanEnd);

  const countByDate = new Map<string, number>();
  for (const date of span) countByDate.set(date, 0);
  const seenPerDate = new Map<string, Set<string>>();
  for (const mark of marks) {
    if (!seenPerDate.has(mark.date)) seenPerDate.set(mark.date, new Set());
    seenPerDate.get(mark.date)!.add(mark.user_id);
  }
  for (const [date, users] of seenPerDate) countByDate.set(date, users.size);

  const coverage: DateCoverageDay[] = span.map((date) => ({
    date,
    count: countByDate.get(date) ?? 0,
  }));

  // A stretch of 2+ days beats a single day that gets one more person
  // there — scoring one-day windows alongside longer ones proposed the
  // Austin weekend (works for 3 of 4) as Saturday alone (all 4). Only in
  // groups of 4+, though: in a group of 3, "one more person" is a third
  // of the trip, so the Napa day trip keeps its day everyone can make. A
  // single day (MIN_DATE_WINDOW) also wins whenever no stretch works for
  // anyone, or two ranges only just touch.
  const multi = bestWindow(coverage, PREFERRED_MIN_WINDOW);
  const single = bestWindow(coverage, MIN_DATE_WINDOW);
  const best =
    !multi || !single
      ? (multi ?? single)
      : single.score <= multi.score || (totalMembers >= 4 && single.score - multi.score <= 1)
        ? multi
        : single;

  if (!best) return { proposal: null, coverage };

  const start_date = span[best.start];
  const end_date = span[best.start + best.len - 1];
  const label =
    best.score >= totalMembers
      ? `works for all ${totalMembers}`
      : `works for ${best.score} of ${totalMembers}`;

  return {
    proposal: { start_date, end_date, score: best.score, label },
    coverage,
  };
}
