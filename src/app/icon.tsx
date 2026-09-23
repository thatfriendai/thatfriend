import { ImageResponse } from "next/og";
import { loadBrandFonts, LogoMark } from "@/lib/og/brand";

// Browser tab icon, and the fallback thumbnail messaging apps use when a
// page has no og:image: the "that friend" logo on its cream disc.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<LogoMark size={size.width} round />, { ...size, fonts: await loadBrandFonts() });
}
