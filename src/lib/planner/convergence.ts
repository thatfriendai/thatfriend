import "server-only";

export interface ConvergenceDot {
  value: number;
  userId: string | null;
  name: string | null;
}

export interface ConvergenceOverlap {
  key: string;
  label: string;
  floor: number;
  comfy: number;
  max: number;
  dots: ConvergenceDot[];
}

/**
 * floor = lowest ceiling (what works for everyone). comfy = the
 * fourth-lowest value (what works for most) — per spec, not a percentile,
 * literally index 3 of the ascending sort. With fewer than 4 answers the
 * highest available value stands in, since there's no "fourth" yet.
 */
export function computeOverlap(
  key: string,
  label: string,
  max: number,
  entries: { value: number; userId: string | null; name: string | null }[]
): ConvergenceOverlap | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.value - b.value);
  const floor = sorted[0].value;
  const comfy = sorted[Math.min(3, sorted.length - 1)].value;

  return {
    key,
    label,
    floor,
    comfy,
    max,
    dots: entries.map((e) => ({ value: e.value, userId: e.userId, name: e.name })),
  };
}

export interface ClusterCount {
  label: string;
  count: number;
  total: number;
}

export function computeClusters(
  interestLists: string[][],
  total: number
): ClusterCount[] {
  const counts = new Map<string, number>();
  for (const list of interestLists) {
    for (const interest of list) {
      counts.set(interest, (counts.get(interest) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, total }))
    .sort((a, b) => b.count - a.count);
}
