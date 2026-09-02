import "server-only";

// Google Maps place pages are 100% client-JS-rendered — fetching one
// returns an "enable JavaScript" shell with no place info anywhere, not
// even in meta tags. But the place name is right there in the URL path
// (`/maps/place/Time+Out+Market+Lisboa/@lat,lng,zoom`), and short links
// (maps.app.goo.gl/...) redirect to that same pattern, which `fetch`
// follows by default — so pull the name from the resolved URL instead of
// trying to scrape the page.
const MAPS_PLACE_RE = /\/maps\/place\/([^/@]+)/;

/**
 * Best-effort "read this link" for place extraction — no headless browser,
 * so JS-rendered pages will come back thin. Good enough for blog posts and
 * articles; Google Maps links are handled separately via the URL itself.
 */
export async function fetchPageText(
  url: string
): Promise<{ text: string; label: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  try {
    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ThatFriendBot/1.0; +https://thatfriend.app)",
      },
    });
    if (!res.ok) return null;

    const mapsMatch = (res.url || parsed.toString()).match(MAPS_PLACE_RE);
    if (mapsMatch) {
      const name = decodeURIComponent(mapsMatch[1].replace(/\+/g, " ")).trim();
      if (name) return { text: `Place: ${name}`, label: name.slice(0, 80) };
    }

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    if (!text) return null;

    const label = parsed.hostname.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "");
    return { text, label: label.slice(0, 80) };
  } catch {
    return null;
  }
}
