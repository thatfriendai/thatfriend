import "server-only";

// Google Maps place pages are 100% client-JS-rendered — fetching one
// returns an "enable JavaScript" shell with no place info anywhere, not
// even in meta tags. But the place name is right there in the resolved
// URL, and short links (maps.app.goo.gl/...) redirect to it, which
// `fetch` follows by default — so pull the name from the resolved URL
// instead of trying to scrape the page. Google uses at least two
// redirect shapes for a shared place link: a path form
// (`/maps/place/Time+Out+Market+Lisboa/@lat,lng,zoom`) and a query form
// (`/maps?q=Uchi+Miami,+252+NW+25th+St,...`) — both are handled here.
const MAPS_PLACE_PATH_RE = /\/maps\/place\/([^/@]+)/;

function extractMapsPlaceName(resolvedUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(resolvedUrl);
  } catch {
    return null;
  }
  if (!/(^|\.)google\.[a-z.]+$/i.test(url.hostname)) return null;

  const pathMatch = url.pathname.match(MAPS_PLACE_PATH_RE);
  if (pathMatch) {
    const name = decodeURIComponent(pathMatch[1].replace(/\+/g, " ")).trim();
    if (name) return name;
  }

  // The query form's "q" is "Name, Address..." — keep just the name.
  const q = url.searchParams.get("q");
  if (q) {
    const name = q.split(",")[0].trim();
    if (name) return name;
  }

  return null;
}

/** HTML attribute values are entity-encoded in the source (e.g. "&amp;" for a literal "&") — a real browser's HTML parser decodes this automatically, but a plain regex extraction like this one doesn't, so it's done by hand here. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Pulls a page's preview image (og:image, falling back to twitter:image) straight out of the raw HTML. */
function findPreviewImage(html: string, pageUrl: string): string | null {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const isPreviewImageTag = (tag: string, key: "og:image" | "twitter:image") =>
    new RegExp(`(?:property|name)=["']${key}["']`, "i").test(tag);

  for (const key of ["og:image", "twitter:image"] as const) {
    const tag = metaTags.find((t) => isPreviewImageTag(t, key));
    const match = tag?.match(/content=["']([^"']+)["']/i);
    if (match) {
      try {
        return new URL(decodeHtmlEntities(match[1]), pageUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Best-effort "read this link" for place extraction — no headless browser,
 * so JS-rendered pages will come back thin. Good enough for blog posts and
 * articles; Google Maps links are handled separately via the URL itself.
 */
export async function fetchPageText(
  url: string
): Promise<{ text: string; label: string; mapsPlaceName?: string; imageUrl?: string } | null> {
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

    const mapsName = extractMapsPlaceName(res.url || parsed.toString());
    if (mapsName) {
      return { text: `Place: ${mapsName}`, label: mapsName.slice(0, 80), mapsPlaceName: mapsName };
    }

    const html = await res.text();
    const imageUrl = findPreviewImage(html, res.url || parsed.toString()) ?? undefined;
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
    return { text, label: label.slice(0, 80), imageUrl };
  } catch {
    return null;
  }
}
