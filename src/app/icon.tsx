import { ImageResponse } from "next/og";
import { loadBrandFonts, OG_COLORS } from "@/lib/og/brand";

// Browser tab icon, and the fallback thumbnail messaging apps use when a
// page has no og:image. Replaces the create-next-app favicon.ico.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
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
          borderRadius: 112,
          color: OG_COLORS.cream,
          fontFamily: "Instrument Serif",
          fontSize: 520,
          lineHeight: 1,
          paddingTop: 352,
          paddingLeft: 52,
        }}
      >
        “
      </div>
    ),
    { ...size, fonts: await loadBrandFonts() },
  );
}
