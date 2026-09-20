/**
 * Hygiene and segmentation for the heuristic memory extractor.
 *
 * Two problems used to live here. First, markup was treated as prose: `[[IMG: masterpiece, best
 * quality, … ]]` became a fact, a conflict and a whole cast of "characters" (IMG, SQUARE, MEDIUM).
 * Second, prose was treated as a bag of sentences: everything that ended in `?` was an open question
 * and every sentence was one thread with the same weight, so a dialogue aside weighed as much as a
 * real obligation.
 *
 * This module fixes the front half: it strips markers, tags and emphasis while keeping the words,
 * drops noise lines that carry no prose at all, and splits what is left into typed beats
 * (narration / dialogue / action / thought) that carry the speaker. The extractor's rules can then
 * require "this is narration" or "this is dialogue from Svetlana".
 */
import { TAG_VOCABULARY, THOUGHT_CUES, escapeRegExp, hasAnyTerm } from "./lexicon.js";

export type BeatKind = "narration" | "dialogue" | "action" | "thought";

export interface Beat {
  kind: BeatKind;
  /** Cleaned text with no markup, no surrounding quotes and no asterisks. */
  text: string;
  /** Speaker detected from the `Nombre:` prefix, when there is one. */
  speaker?: string;
  messageId: string;
  role: "user" | "assistant";
}

export interface BeatSource {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const BREAK_RE = /<\s*br\s*\/?\s*>/gi;
const HTML_TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]{0,600})?\/?>/g;
/** `[[IMG: …]]`, `[[SQUARE]]`, `[[anything]]`: image metadata, never prose. */
const MARKER_RE = /\[\[[\s\S]{0,6000}?\]\]/g;
/** Single-bracket markers that are pure metadata rather than markdown links. */
const SINGLE_MARKER_RE = /\[(?:IMG|IMAGE|TAGS?|GEN|GENRE|SYSTEM|OOC|ASSETS?)\s*:[^\]\n]{0,6000}?\]/gi;
const MUSTACHE_RE = /\{\{[\s\S]{0,400}?\}\}/g;
const MARKDOWN_LINK_RE = /\[([^\]\n]{1,300})\]\((?:https?:\/\/|\/)[^)\s]{0,400}\)/g;
const TRIPLE_EMPHASIS_RE = /\*\*\*([^*\n]{1,900})\*\*\*/g;
const DOUBLE_EMPHASIS_RE = /\*\*([^*\n]{1,900})\*\*/g;
const UNDERSCORE_EMPHASIS_RE = /(?<![\p{L}\p{N}])__(?:[^_\n]{1,900})__(?![\p{L}\p{N}])/gu;
const STRIKE_RE = /~~([^~\n]{1,900})~~/g;
const SPOILER_RE = /\|\|([^|\n]{1,900})\|\|/g;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,10});/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const code = body.startsWith("#x") || body.startsWith("#X") ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return "";
        }
      }
      return "";
    }
    return NAMED_ENTITIES[body.toLocaleLowerCase()] ?? "";
  });
}

/**
 * Removes markup while keeping the prose it decorated. Emphasis is unwrapped, not deleted; HTML tags
 * and entities disappear (or become their character); `[[…]]` image markers are dropped whole.
 */
export function stripMarkup(input: string): string {
  let text = String(input ?? "").replace(/\r\n?/g, "\n");
  text = text.replace(ZERO_WIDTH_RE, "");
  text = text.replace(HTML_COMMENT_RE, "");
  text = text.replace(BREAK_RE, "\n");
  text = text.replace(MARKER_RE, " ");
  text = text.replace(SINGLE_MARKER_RE, " ");
  text = text.replace(MUSTACHE_RE, " ");
  text = text.replace(HTML_TAG_RE, " ");
  text = decodeEntities(text);
  text = text.replace(MARKDOWN_LINK_RE, "$1");
  text = text.replace(TRIPLE_EMPHASIS_RE, "$1");
  text = text.replace(DOUBLE_EMPHASIS_RE, "$1");
  text = text.replace(UNDERSCORE_EMPHASIS_RE, (match) => match.replace(/^__/, "").replace(/__$/, ""));
  text = text.replace(STRIKE_RE, "$1");
  text = text.replace(SPOILER_RE, "$1");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .trim();
}

/**
 * A line is noise when it holds no prose: only markup, bullets, an image tag list or whitespace.
 * Markup is stripped here as well so the check is meaningful on raw lines, not only on sanitized
 * ones (`<div></div>` is noise, `<div>Ella sonríe</div>` is prose).
 */
export function isNoiseLine(line: string): boolean {
  const trimmed = stripMarkup(line).trim();
  if (!trimmed) return true;
  const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  if (letters.length < 3) return true;
  return looksLikeTagList(trimmed);
}

/**
 * Tag lists ("masterpiece, best quality, absurdres, 1girl, …") are comma/semicolon soup: many short
 * parts, few words each, and a heavy share of generation vocabulary. Real prose has commas too, but
 * its parts are clause-length, so the density check keeps it.
 */
export function looksLikeTagList(line: string): boolean {
  const parts = line
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 5) return false;
  const words = line.split(/\s+/).filter(Boolean);
  const commaDensity = parts.length / Math.max(1, words.length);
  if (commaDensity < 0.3) return false;
  const shortParts = parts.filter((part) => part.split(/\s+/).length <= 4 && part.length <= 40);
  const tagLike = parts.filter((part) => TAG_VOCABULARY.has(part.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim()));
  return shortParts.length / parts.length >= 0.8 || tagLike.length / parts.length >= 0.4;
}

const LIST_MARKER_RE = /^\s*(?:[>\u2022\u00b7]|[-*+]\s|\(\d+\)|\d+[.)]\s)+\s*/u;

function cleanLine(line: string): string {
  return line.replace(LIST_MARKER_RE, "").trim();
}

const SPEAKER_RE = /^([\p{Lu}][\p{L}\p{M}'’-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’-]*){0,2})\s*[:：]\s*(.*)$/u;
const THOUGHT_LINE_RE =
  /^([\p{Lu}][\p{L}\p{M}'’-]*(?:\s+[\p{Lu}][\p{L}\p{M}'’-]*)?)\s+(?:piensa|pensó|pensaba|reflexiona|reflexionó|se pregunta|se preguntó|imagina|imagina|recuerda)\s*[:：,]?\s*(.*)$/u;

/** Quoted dialogue, `*action*` spans and `(thoughts)`, in order of appearance. */
const SEGMENT_RE = /"([^"\n]{1,900})"|“([^”\n]{1,900})”|«([^»\n]{1,900})»|\*([^*\n]{1,900})\*|\(([^()\n]{1,900})\)/gu;

function tidy(value: string): string {
  return value
    .replace(/\*/g, "")
    .replace(/^[\s"'“”«»\-–—:]+/, "")
    .replace(/[\s"'“”«»]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function actionOrThought(text: string): BeatKind {
  return hasAnyTerm(text, THOUGHT_CUES) ? "thought" : "action";
}

/**
 * Splits one cleaned line into beats. A `Nombre:` prefix names the speaker for the whole line; quoted
 * spans are dialogue, `*…*` spans are action (or thought when they carry a thinking verb), `(…)`
 * spans are thought, and whatever is left over is narration.
 */
export function segmentLine(line: string, messageId: string, role: "user" | "assistant"): Beat[] {
  const beats: Beat[] = [];
  const push = (kind: BeatKind, text: string, speaker?: string) => {
    const cleaned = tidy(text);
    if (cleaned.length < 2) return;
    beats.push({ kind, text: cleaned, speaker, messageId, role });
  };

  let rest = line;
  let speaker: string | undefined;
  let explicitThought = false;
  const speakerMatch = rest.match(SPEAKER_RE);
  if (speakerMatch) {
    speaker = speakerMatch[1];
    rest = speakerMatch[2];
  } else {
    const thoughtMatch = rest.match(THOUGHT_LINE_RE);
    if (thoughtMatch) {
      speaker = thoughtMatch[1];
      rest = thoughtMatch[2];
      explicitThought = true;
    }
  }

  if (!rest.trim()) {
    // A bare `Nombre:` line still proves the speaker was on stage, but carries no claim.
    return beats;
  }

  const parts: Array<{ kind: BeatKind; text: string }> = [];
  let cursor = 0;
  SEGMENT_RE.lastIndex = 0;
  for (let match = SEGMENT_RE.exec(rest); match; match = SEGMENT_RE.exec(rest)) {
    const index = match.index;
    if (index > cursor) parts.push({ kind: "narration", text: rest.slice(cursor, index) });
    const quoted = match[1] ?? match[2] ?? match[3];
    if (quoted !== undefined) parts.push({ kind: "dialogue", text: quoted });
    else if (match[4] !== undefined) parts.push({ kind: actionOrThought(match[4]), text: match[4] });
    else if (match[5] !== undefined) parts.push({ kind: "thought", text: match[5] });
    cursor = index + match[0].length;
  }
  if (cursor < rest.length) parts.push({ kind: "narration", text: rest.slice(cursor) });

  // `Nombre: text` without quotes is the standard roleplay dialogue format.
  if (speaker && !parts.some((part) => part.kind !== "narration")) {
    push(explicitThought ? "thought" : "dialogue", rest, speaker);
    return beats;
  }
  if (explicitThought && parts.length <= 1) {
    push("thought", parts[0]?.text ?? rest, speaker);
    return beats;
  }

  for (const part of parts) {
    push(part.kind, part.text, part.kind === "narration" ? undefined : speaker);
  }
  return beats;
}

/** Sanitised, noise-filtered, typed beats for a whole message. */
export function segmentMessage(message: BeatSource): { text: string; beats: Beat[] } {
  const text = stripMarkup(message.content);
  const beats: Beat[] = [];
  for (const rawLine of text.split("\n")) {
    const line = cleanLine(rawLine);
    if (isNoiseLine(line)) continue;
    beats.push(...segmentLine(line, message.id, message.role));
  }
  return { text, beats };
}

export function collectBeats(messages: readonly BeatSource[]): { text: string; beats: Beat[] } {
  const segments = messages.map(segmentMessage);
  return {
    text: segments.map((segment) => segment.text).join("\n"),
    beats: segments.flatMap((segment) => segment.beats),
  };
}

/** Sentence splitting that keeps `¿…?` and `¡…!` intact. */
export function splitSentences(text: string, maxLength = 1_000): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 4 && sentence.length <= maxLength);
}

/** Lowercased, accent-folded token used to compare against the blocklists. */
export function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLocaleLowerCase();
}

/** Escapes a literal for use inside a `wholeWord` fragment. */
export { escapeRegExp };
