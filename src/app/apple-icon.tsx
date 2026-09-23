import { ImageResponse } from "next/og";
import { loadBrandFonts, OG_COLORS } from "@/lib/og/brand";

// Home-screen icon on iOS — square and full-bleed; iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLORS.plum,
          color: OG_COLORS.cream,
          fontFamily: "Instrument Serif",
          fontSize: 190,
          lineHeight: 1,
          paddingTop: 128,
          paddingLeft: 19,
        }}
      >
        “
      </div>
    ),
    { ...size, fonts: await loadBrandFonts() },
  );
}
