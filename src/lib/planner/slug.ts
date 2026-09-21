/**
 * "Istanbul" -> "istanbul", "Mexico City, Mexico" -> "mexico-city": the
 * readable part of an invite link (/join/istanbul/<token>). Purely
 * cosmetic — the token is what resolves the trip, so an old or edited slug
 * still lands on the right page.
 */
export function slugify(text: string): string {
  const slug = text
    .split(",")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "trip";
}
