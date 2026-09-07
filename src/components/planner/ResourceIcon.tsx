import type { ResourceType } from "@/lib/supabase/planner-types";
import { isGoogleMapsUrl } from "@/lib/planner/mapsLink";

type ResourceKind = "maps" | "link" | "text" | "screenshot";

function resourceKind(type: ResourceType, sourceUrl: string | null): ResourceKind {
  if (type === "link" && isGoogleMapsUrl(sourceUrl)) return "maps";
  if (type === "link") return "link";
  return type;
}

const KIND_STYLE: Record<ResourceKind, { color: string; icon: React.ReactNode }> = {
  maps: {
    color: "#3F6E7A",
    icon: (
      <>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
  link: {
    color: "#8A5A7A",
    icon: (
      <>
        <path d="M9 17H7a5 5 0 0 1 0-10h2" />
        <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </>
    ),
  },
  text: {
    color: "#6B655C",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />,
  },
  screenshot: {
    color: "#C9A227",
    icon: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
  },
};

export function ResourceTile({
  type,
  sourceUrl,
  size = 42,
  className,
}: {
  type: ResourceType;
  sourceUrl: string | null;
  size?: number;
  className?: string;
}) {
  const { color, icon } = KIND_STYLE[resourceKind(type, sourceUrl)];
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
        {icon}
      </svg>
    </div>
  );
}
