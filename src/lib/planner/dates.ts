import "server-only";

const MIN_WINDOW = 2;
const MAX_WINDOW = 10;

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
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
 * Every contiguous window of 2-10 days within the marked span is scored by
 * its weakest day (a stretch is only as good as the day fewest people can
 * make), then the highest-scoring window wins — longer windows and higher
 * total coverage break ties. Mirrors convergence's floor/comfy language:
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

  let best: { start: number; len: number; score: number; sum: number } | null = null;

  for (let start = 0; start < span.length; start++) {
    let minCount = Infinity;
    let sum = 0;
    for (let len = 1; len <= MAX_WINDOW && start + len <= span.length; len++) {
      const count = coverage[start + len - 1].count;
      minCount = Math.min(minCount, count);
      sum += count;
      if (len < MIN_WINDOW) continue;

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

  if (!best || best.score === 0) return { proposal: null, coverage };

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
