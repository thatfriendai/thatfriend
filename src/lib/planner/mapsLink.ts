const MAPS_URL_RE = /(?:maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps)/i;

export function isGoogleMapsUrl(url: string | null | undefined): boolean {
  return !!url && MAPS_URL_RE.test(url);
}
