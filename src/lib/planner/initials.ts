/**
 * Avatar-initial helpers that cut on user-perceived characters (grapheme
 * clusters), not UTF-16 code units. `name[0]` / `name.slice(0, 2)` split an
 * emoji or other astral character in half and render a lone surrogate "�"
 * — and names like "🦄 Sam" or "Zoë-Marie 🌸" are real member names.
 * Client-safe: no server imports.
 */

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  // Older runtimes: code points at least never split a surrogate pair,
  // even if a ZWJ emoji sequence might come apart.
  return Array.from(text);
}

/** The first `count` grapheme clusters of `text`, uppercased. */
export function leadingChars(text: string, count = 2): string {
  return graphemes(text.trim()).slice(0, count).join("").toUpperCase();
}

/** First character of each of the first two words — "Ana Lima" → "AL". */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => graphemes(word)[0] ?? "")
    .join("")
    .toUpperCase();
}
