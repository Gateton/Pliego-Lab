// Deterministic clean-up of the Image Director's [[IMG:...]] tag chains. The Director prompt asks
// for clean Danbooru tags, but a model under a minimum-tag pressure still slips in things the image
// model reads the wrong way: negations ("no underwear" draws underwear), sentences, underscores,
// repeated tags. This pass removes exactly those, and nothing that could carry meaning.

/** Real Danbooru tags that start with "no" and mean what they say to the image model. */
const ALLOWED_NEGATION_TAGS = new Set(["no bra", "no panties", "no humans"]);
const NEGATION_RE = /^(?:no|without|not|non|never|lacking|missing)\s/i;
const ABSENCE_RE = /\b(?:removed|taken off|not wearing|no longer)\b/i;
/** Danbooru tags are short. Anything longer is prose the image model cannot parse as one concept. */
const MAX_WORDS_PER_TAG = 6;

export interface SanitizedTags {
  tags: string[];
  dropped: string[];
}

export function sanitizeTagList(prompt: string): SanitizedTags {
  const tags: string[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();
  for (const raw of prompt.split(",")) {
    const tag = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    const isNegation = (NEGATION_RE.test(tag) || ABSENCE_RE.test(tag)) && !ALLOWED_NEGATION_TAGS.has(key);
    const isSentence = tag.split(" ").length > MAX_WORDS_PER_TAG;
    if (isNegation || isSentence) {
      dropped.push(tag);
      continue;
    }
    seen.add(key);
    tags.push(tag);
  }
  return { tags, dropped };
}

/**
 * Cleans one `[[IMG: tags | AR | SHOT | SEED]]` marker. The control fields after the first `|`
 * are left exactly as written: the marker parser owns their validation and repair.
 */
export function sanitizeImageMarker(marker: string): { marker: string; dropped: string[] } {
  const inner = marker.replace(/^\[\[IMG:\s*/, "").replace(/\s*\]\]$/, "");
  const pipe = inner.indexOf("|");
  const prompt = pipe >= 0 ? inner.slice(0, pipe) : inner;
  const rest = pipe >= 0 ? inner.slice(pipe) : "";
  const { tags, dropped } = sanitizeTagList(prompt);
  if (dropped.length === 0 && tags.join(", ") === prompt.trim()) return { marker, dropped };
  return { marker: `[[IMG: ${tags.join(", ")}${rest ? ` ${rest.trim()}` : ""}]]`, dropped };
}

/** Applies `sanitizeImageMarker` to every marker in a text. */
export function sanitizeImageMarkers(text: string): { text: string; dropped: string[] } {
  const dropped: string[] = [];
  const cleaned = text.replace(/\[\[IMG:[\s\S]*?\]\]/g, (marker) => {
    const result = sanitizeImageMarker(marker);
    dropped.push(...result.dropped);
    return result.marker;
  });
  return { text: cleaned, dropped };
}
