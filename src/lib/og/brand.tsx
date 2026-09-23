import "server-only";

/**
 * Shared bits for the images Next renders with next/og — the favicon, the
 * site-wide link preview and the per-invite one — so a link pasted into
 * WhatsApp/iMessage looks like That Friend instead of the starter-template
 * Vercel triangle (which is what showed when there was no og:image).
 */

// Hero palette from the landing page (src/app/page.tsx).
export const OG_COLORS = {
  plum: "#33253C",
  cream: "#FBF6EC",
  blush: "#D8AEC8",
  muted: "#B9A3B4",
} as const;

type FontFace = { name: string; data: ArrayBuffer; style: "normal" | "italic"; weight: 400 };

let fontsPromise: Promise<FontFace[]> | null = null;

/**
 * Instrument Serif — the wordmark's face — pulled from Google Fonts. Asked
 * for without a browser user agent, the CSS API hands back TrueType, which
 * is what Satori reads (it can't do woff2). If the fetch fails the images
 * still render in next/og's built-in sans rather than erroring.
 */
export function loadBrandFonts(): Promise<FontFace[]> {
  fontsPromise ??= (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1")).text();
      const faces = [...css.matchAll(/font-style:\s*(normal|italic);[\s\S]*?src:\s*url\(([^)]+)\)/g)];
      return await Promise.all(
        faces.map(async ([, style, url]) => ({
          name: "Instrument Serif",
          data: await (await fetch(url)).arrayBuffer(),
          style: style as "normal" | "italic",
          weight: 400 as const,
        })),
      );
    } catch {
      fontsPromise = null;
      return [];
    }
  })();
  return fontsPromise;
}

/** “that friend” — the wordmark as it's set in the site header. */
export function Wordmark({ size, color = OG_COLORS.blush }: { size: number; color?: string }) {
  return <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: size, color }}>“that friend”</div>;
}
