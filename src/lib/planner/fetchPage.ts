import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Google Maps place pages are 100% client-JS-rendered — fetching one
// returns an "enable JavaScript" shell with no place info anywhere, not
// even in meta tags. But the place name is right there in the resolved
// URL, and short links (maps.app.goo.gl/...) redirect to it, which
// safeFetch below follows hop by hop — so pull the name from the resolved
// URL instead of trying to scrape the page. Google uses at least two
// redirect shapes for a shared place link: a path form
// (`/maps/place/Time+Out+Market+Lisboa/@lat,lng,zoom`) and a query form
// (`/maps?q=Uchi+Miami,+252+NW+25th+St,...`) — both are handled here.
const MAPS_PLACE_PATH_RE = /\/maps\/place\/([^/@]+)/;
const MAPS_AT_COORDS_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

/**
 * A shared Maps link identifies one exact place, and the resolved URL
 * usually says exactly where: the query form carries the full address
 * ("Diner, 85 Broadway, Brooklyn, NY 11249"), the path form the map's
 * coordinates. `query` keeps all of that for geocoding — searching the
 * bare name with a nudge toward the trip's city is how "Diner" in
 * Brooklyn became a Diner in Sultanahmet.
 */
export interface MapsPlace {
  name: string;
  query: string;
  lat?: number;
  lng?: number;
}

function extractMapsPlace(resolvedUrl: string): MapsPlace | null {
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
    if (name) {
      const coords = url.pathname.match(MAPS_AT_COORDS_RE);
      return coords
        ? { name, query: name, lat: Number(coords[1]), lng: Number(coords[2]) }
        : { name, query: name };
    }
  }

  const q = url.searchParams.get("q");
  if (q) {
    const name = q.split(",")[0].trim();
    if (name) return { name, query: q.replace(/\s+/g, " ").trim() };
  }

  return null;
}

function isTikTokUrl(url: URL): boolean {
  return /(^|\.)tiktok\.com$/i.test(url.hostname);
}

/**
 * TikTok serves a plain fetch an empty app shell — but its public oEmbed
 * returns the caption as the title, which is where people put the place
 * ("📍Lacivert Restaurant #istanbul"). Same idea as YouTube below.
 */
async function fetchTikTokOEmbed(url: string): Promise<{ title: string; imageUrl?: string } | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.title !== "string" || !data.title.trim()) return null;
    const author = typeof data.author_name === "string" ? ` (@${data.author_name})` : "";
    return { title: `${data.title.trim()}${author}`, imageUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : undefined };
  } catch {
    return null;
  }
}

function isYouTubeUrl(url: URL): boolean {
  return /(^|\.)youtube\.com$/i.test(url.hostname) || /(^|\.)youtu\.be$/i.test(url.hostname);
}

/**
 * YouTube's own server-rendered HTML is unreliable for a plain fetch — no
 * cookies means it can come back as a bare region/consent shell titled
 * just "YouTube", with none of the real video info anywhere in the markup.
 * The public oEmbed endpoint sidesteps all of that: no API key, no
 * scraping, and it reliably returns the real title for any public video.
 */
async function fetchYouTubeOEmbed(url: string): Promise<{ title: string; imageUrl?: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.title !== "string" || !data.title.trim()) return null;
    return { title: data.title.trim(), imageUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : undefined };
  } catch {
    return null;
  }
}

/**
 * When a link can't be read at all (bot-blocked — Forbes and plenty of
 * other news/blog sites do this to a plain server fetch), the raw URL is
 * an ugly, unreadable label. Most article URLs embed the actual headline
 * in their last path segment ("...right-now" style slugs) — good enough to
 * de-slugify into something readable instead of showing the full URL.
 */
export function deriveLabelFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    const cleaned = decodeURIComponent(last)
      .replace(/\.\w{2,5}$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (cleaned.length > 3 && !/^\d+$/.test(cleaned)) {
      return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } catch {
    // fall through
  }
  return url;
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

/** Pulls a human-readable page/video title — og:title first (more reliable for YouTube, articles with a shorter display title than their <title> tag), falling back to the <title> tag itself. */
function findPageTitle(html: string): string | null {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const ogTitleTag = metaTags.find((t) => /(?:property|name)=["']og:title["']/i.test(t));
  const ogMatch = ogTitleTag?.match(/content=["']([^"']+)["']/i);
  if (ogMatch) {
    const title = decodeHtmlEntities(ogMatch[1]).trim();
    if (title) return title;
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    const title = decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim();
    if (title) return title;
  }

  return null;
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

// ---------------------------------------------------------------------------
// SSRF guard. Anyone who can text the number chooses the URL this server
// fetches, so without this "http://169.254.169.254/latest/meta-data/" or a
// link that redirects to localhost would be fetched from inside our own
// network. Every hop of a redirect chain is checked, not just the first.
// (A DNS answer that changes between our lookup and fetch's own can still
// slip past — closing that needs a pinned-IP agent, which this doesn't do.)
// ---------------------------------------------------------------------------

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

function isPrivateIPv4([a, b]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8 — "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/**
 * True for any address a link from a stranger has no business reaching:
 * loopback, private, link-local, CGNAT, unspecified, multicast, IPv6
 * unique-local — and IPv4-mapped IPv6 forms of all of those. Anything that
 * isn't a parseable IP counts as private (fail closed).
 */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();
  const v4 = ipv4Octets(addr);
  if (v4) return isPrivateIPv4(v4);
  if (isIP(addr) !== 6) return true;

  // ::ffff:127.0.0.1 and its hex spelling ::ffff:7f00:1
  const mappedDotted = addr.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) {
    const octets = ipv4Octets(mappedDotted[1]);
    return octets ? isPrivateIPv4(octets) : true;
  }
  const mappedHex = addr.match(/^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateIPv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }

  if (addr === "::" || addr === "::1") return true;
  const firstHextet = parseInt(addr.split(":")[0] || "0", 16);
  if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  );
}

/** True when `url` is http(s) and every address its host resolves to is public. */
async function isPublicUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || isBlockedHostname(host)) return false;
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

/**
 * fetch() that re-checks every redirect hop against isPublicUrl. Maps short
 * links (maps.app.goo.gl → google.com/maps/place/…) still resolve — the
 * loop just walks the same chain fetch would have. Returns the final URL
 * alongside the response, since a manual-redirect response's own `url` is
 * only the last hop requested.
 */
async function safeFetch(start: URL, init: RequestInit): Promise<{ res: Response; url: URL } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicUrl(url))) return null;
    const res = await fetch(url.toString(), { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      try {
        url = new URL(location, url);
      } catch {
        return null;
      }
      continue;
    }
    return { res, url };
  }
  return null;
}

/** The body as text, stopping at MAX_BODY_BYTES — a link to a multi-GB file shouldn't be read into memory. */
async function readCappedText(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(total, MAX_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const room = bytes.length - offset;
    if (room <= 0) break;
    bytes.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Best-effort "read this link" for place extraction — no headless browser,
 * so JS-rendered pages will come back thin. Good enough for blog posts and
 * articles; Google Maps links are handled separately via the URL itself.
 */
export async function fetchPageText(
  url: string
): Promise<{ text: string; label: string; mapsPlace?: MapsPlace; imageUrl?: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  if (isTikTokUrl(parsed)) {
    const oembed = await fetchTikTokOEmbed(parsed.toString());
    if (oembed) {
      return { text: `Video caption: ${oembed.title}`, label: oembed.title.slice(0, 120), imageUrl: oembed.imageUrl };
    }
  }

  if (isYouTubeUrl(parsed)) {
    const oembed = await fetchYouTubeOEmbed(parsed.toString());
    if (oembed) {
      return { text: `Video: ${oembed.title}`, label: oembed.title.slice(0, 120), imageUrl: oembed.imageUrl };
    }
    // Falls through to the generic scrape below if oEmbed itself fails —
    // still better than nothing for an unlisted/embed-disabled video.
  }

  try {
    const fetched = await safeFetch(parsed, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ThatFriendBot/1.0; +https://thatfriend.app)",
      },
    });
    if (!fetched) return null;
    const { res, url: finalUrl } = fetched;
    if (!res.ok) return null;

    const mapsPlace = extractMapsPlace(finalUrl.toString());
    if (mapsPlace) {
      await res.body?.cancel().catch(() => undefined);
      return { text: `Place: ${mapsPlace.query}`, label: mapsPlace.name.slice(0, 80), mapsPlace };
    }

    const html = await readCappedText(res);
    const imageUrl = findPreviewImage(html, finalUrl.toString()) ?? undefined;
    const pageTitle = findPageTitle(html);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);

    if (!text && !pageTitle) return null;

    // The real page/video title reads far better than a bare domain+path,
    // which is all this fell back to before — that fallback only kicks in
    // for the rare page with no <title> or og:title at all.
    const label = pageTitle ?? parsed.hostname.replace(/^www\./, "") + parsed.pathname.replace(/\/$/, "");
    return { text, label: label.slice(0, 120), imageUrl };
  } catch {
    return null;
  }
}
