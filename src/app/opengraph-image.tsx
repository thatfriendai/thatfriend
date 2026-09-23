import { ImageResponse } from "next/og";
import { loadBrandFonts, OG_COLORS, Wordmark } from "@/lib/og/brand";

// The preview card for any That Friend link that doesn't draw its own
// (invite links do — see src/app/api/og/invite/[token]/route.tsx).
export const alt = "That Friend — the group trip that actually happens";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLORS.plum,
          gap: 28,
        }}
      >
        <Wordmark size={132} color={OG_COLORS.cream} />
        <div style={{ display: "flex", fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 48, color: OG_COLORS.blush }}>
          The group trip that actually happens.
        </div>
      </div>
    ),
    { ...size, fonts: await loadBrandFonts() },
  );
}
