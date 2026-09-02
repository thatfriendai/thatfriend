import { kindColor } from "@/lib/planner/itinerary";
import type { PlaceKind } from "@/lib/supabase/planner-types";

const ICON_PATHS: Record<PlaceKind, React.ReactNode> = {
  Restaurants: (
    <>
      <path d="M4 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M6 2v20" />
      <path d="M18 2a4 4 0 0 0-4 4v5c0 1.1.9 2 2 2h2m0-11v20" />
    </>
  ),
  "Coffee shops": (
    <>
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <path d="M6 2v3M10 2v3M14 2v3" />
    </>
  ),
  Bars: (
    <>
      <path d="M8 22h8" />
      <path d="M12 12v10" />
      <path d="M19 3H5l7 9Z" />
    </>
  ),
  Museums: (
    <>
      <path d="M3 22h18" />
      <path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" />
      <path d="M2 8l10-6 10 6Z" />
    </>
  ),
  Activities: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5Z" />
    </>
  ),
  Other: (
    <>
      <path d="M19 10c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 0 1 14 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
};

export function PlaceKindTile({
  kind,
  size = 54,
  className,
}: {
  kind: PlaceKind;
  size?: number;
  className?: string;
}) {
  const color = kindColor(kind);
  return (
    <div
      className={`flex flex-none items-center justify-center rounded-lg border ${className ?? ""}`}
      style={{ width: size, height: size, background: `${color}17`, borderColor: `${color}30` }}
    >
      <svg
        width={size * 0.42}
        height={size * 0.42}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON_PATHS[kind] ?? ICON_PATHS.Other}
      </svg>
    </div>
  );
}
