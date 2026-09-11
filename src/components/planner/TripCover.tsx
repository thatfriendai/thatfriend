import { stampFor, stripeFor } from "@/lib/planner/cover";

type CoverSize = "thumb" | "card" | "hero";

const SIZE = {
  thumb: { pad: 4, radius: 8, label: 0, script: 0, meta: 0, stamp: 0, showText: false },
  card: { pad: 7, radius: 10, label: 8, script: 34, meta: 8, stamp: 42, showText: true },
  hero: { pad: 10, radius: 14, label: 10, script: 52, meta: 10.5, stamp: 62, showText: true },
} as const;

export function TripCover({
  place,
  tint,
  placeCount,
  size,
}: {
  place: string;
  tint: string;
  placeCount?: string;
  size: CoverSize;
}) {
  const s = SIZE[size];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: s.radius,
        overflow: "hidden",
        background: "#FBF7EF",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: s.pad,
          boxSizing: "border-box",
          background: stripeFor(tint),
        }}
      >
        <div style={{ width: "100%", height: "100%", background: "#FBF7EF", borderRadius: Math.max(s.radius - 3, 0) }} />
      </div>

      {s.showText && (
        <>
          <div
            style={{
              position: "absolute",
              left: s.pad * 3.5,
              top: s.pad * 4,
              right: s.stamp + s.pad * 3,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: s.label,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#6E675E",
                marginBottom: 6,
              }}
            >
              Par avion · by air mail
            </div>
            <div
              style={{
                fontFamily: "var(--font-script), cursive",
                fontWeight: 600,
                fontSize: s.script,
                lineHeight: 0.92,
                color: tint,
              }}
            >
              {place}
            </div>
            {placeCount && (
              <>
                <div style={{ width: Math.round(s.script * 1.6), height: 1, background: "#DCD4C4", margin: `${Math.round(s.script * 0.28)}px 0 ${Math.round(s.script * 0.2)}px` }} />
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: s.meta,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#8C8478",
                  }}
                >
                  {placeCount}
                </div>
              </>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              right: s.pad * 3,
              bottom: s.pad * 3,
              width: s.stamp,
              height: s.stamp,
              border: `1.3px solid ${tint}`,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(-9deg)",
              color: tint,
              fontFamily: "var(--font-mono), monospace",
              fontSize: Math.round(s.stamp * 0.18),
              letterSpacing: "0.08em",
              textAlign: "center",
            }}
          >
            {stampFor(place)}
          </div>
        </>
      )}
    </div>
  );
}
