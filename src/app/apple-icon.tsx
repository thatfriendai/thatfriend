import { ImageResponse } from "next/og";
import { loadBrandFonts, LogoMark } from "@/lib/og/brand";

// Home-screen icon on iOS — square and full-bleed; iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<LogoMark size={size.width} round={false} />, { ...size, fonts: await loadBrandFonts() });
}
