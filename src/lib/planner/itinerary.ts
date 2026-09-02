import type { PlaceKind } from "@/lib/supabase/planner-types";

export const DAY_COLORS = [
  "#8A5A7A",
  "#3F6E7A",
  "#6E8C6A",
  "#C9A227",
  "#B4664A",
  "#5B6478",
] as const;

export const KIND_OPTIONS: { kind: PlaceKind; color: string }[] = [
  { kind: "Restaurants", color: "#B4664A" },
  { kind: "Coffee shops", color: "#6F4E37" },
  { kind: "Bars", color: "#8A5A7A" },
  { kind: "Museums", color: "#3F6E7A" },
  { kind: "Activities", color: "#C9A227" },
  { kind: "Other", color: "#6B655C" },
];

export function kindColor(kind: string): string {
  return KIND_OPTIONS.find((k) => k.kind === kind)?.color ?? "#6B655C";
}

/**
 * Deterministic pseudo-random position for a map pin, kept away from the
 * very edge (8–92%) so pins never clip the frame. There's no real geocoding
 * yet — the map is a stylized backdrop, and pins just need a stable spot
 * that doesn't stack on top of each other for the same seed.
 */
export function hashPercent(seed: string): { x: number; y: number } {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  };
  const x = 8 + (hash(seed + ":x") % 8401) / 100;
  const y = 8 + (hash(seed + ":y") % 8401) / 100;
  return { x, y };
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
    .toUpperCase();
}
