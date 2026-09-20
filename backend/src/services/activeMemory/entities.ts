/**
 * Entity anchoring.
 *
 * The old rule accepted any capitalised token that appeared mid-sentence, which is how "IMG",
 * "SQUARE", "MEDIUM", "RANDOM", "Su" and "Cámara" became characters. A name is now an entity only
 * when
 *
 *   - the chat already knows it (`knownNames`: character card + NPC roster), or
 *   - it appears at least twice in the window, at least once somewhere other than the start of a
 *     sentence (Spanish capitalises every sentence, so a leading capital proves nothing), and it is
 *     not a tag, a function word, a verb that commonly opens a sentence, or an ALLCAPS acronym.
 */
import { FUNCTION_WORDS, NON_NAME_VERBS, TAG_VOCABULARY, escapeRegExp } from "./lexicon.js";
import { normalizeToken, stripMarkup } from "./segments.js";

const NAME_TOKEN_RE = /(?<![\p{L}\p{N}])([\p{Lu}][\p{L}\p{M}'’-]{1,29})(?![\p{L}\p{N}])/gu;
const SENTENCE_START_RE = /(?:^|[\n.!?…¡¿])[\s"'«»“”¡¿\-–—*]*$/u;

export interface EntityAnchors {
  /** Canonical names the chat already knows, in the order supplied. */
  known: string[];
  /** Names discovered in the window by the repetition rule, in order of first appearance. */
  dynamic: string[];
  /** `known` then `dynamic`: the names that may reach the ledger. */
  all: string[];
  /** Normalised keys of `all`, plus their aliases (first names of multi-word names). */
  keys: Set<string>;
}

function isBlocked(token: string): boolean {
  const key = normalizeToken(token);
  if (!key || key.length < 3) return true;
  if (FUNCTION_WORDS.has(key) || TAG_VOCABULARY.has(key) || NON_NAME_VERBS.has(key)) return true;
  // IMG, SQUARE, MEDIUM, RANDOM: stylised all-caps tokens are prompt scaffolding, not names.
  if (token.length > 1 && token === token.toLocaleUpperCase() && /[A-ZÀ-Þ]/.test(token) && !/[\p{Ll}]/u.test(token)) {
    return true;
  }
  return false;
}

interface CandidateStats {
  token: string;
  total: number;
  midSentence: number;
}

function countCandidates(text: string, stats: Map<string, CandidateStats>): void {
  NAME_TOKEN_RE.lastIndex = 0;
  for (let match = NAME_TOKEN_RE.exec(text); match; match = NAME_TOKEN_RE.exec(text)) {
    const token = match[1];
    if (isBlocked(token)) continue;
    const index = match.index;
    const before = text.slice(0, index);
    const sentenceStart = SENTENCE_START_RE.test(before);
    // A `Name:` label is a speaker tag: strong evidence the token is a name even at line start.
    const after = text.slice(index + token.length, index + token.length + 2);
    const speakerLabel = /^\s*[:：]/u.test(after);
    const key = normalizeToken(token);
    const entry = stats.get(key) ?? { token, total: 0, midSentence: 0 };
    entry.total += 1;
    if (!sentenceStart || speakerLabel) entry.midSentence += 1;
    stats.set(key, entry);
  }
}

export function collectAnchors(
  messages: readonly { id: string; role: "user" | "assistant"; content: string }[],
  knownNames: readonly string[] = [],
): EntityAnchors {
  const known: string[] = [];
  const seen = new Set<string>();
  for (const raw of knownNames) {
    const name = String(raw ?? "").trim();
    const key = normalizeToken(name);
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    known.push(name);
  }

  const stats = new Map<string, CandidateStats>();
  for (const message of messages) countCandidates(stripMarkup(message.content), stats);

  const dynamic: string[] = [];
  const candidates = [...stats.values()]
    .filter((entry) => entry.total >= 2 && entry.midSentence >= 1)
    .sort((left, right) => right.total - left.total);
  for (const entry of candidates) {
    const key = normalizeToken(entry.token);
    if (seen.has(key)) continue;
    seen.add(key);
    dynamic.push(entry.token);
  }

  const all = [...known, ...dynamic];
  const keys = new Set<string>();
  for (const name of all) {
    keys.add(normalizeToken(name));
    // "Elena Voronova" is also reachable as "Elena" in prose.
    const first = name.split(/\s+/)[0];
    if (first) keys.add(normalizeToken(first));
  }
  return { known, dynamic, all, keys };
}

function nameRegex(name: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "iu");
}

/** Anchored names present in `text`, in the anchor order. */
export function presentNames(text: string, anchors: EntityAnchors): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const name of anchors.all) {
    if (nameRegex(name).test(text)) found.push(name);
  }
  return found;
}

/** True when `text` mentions at least one anchored entity. */
export function hasAnchoredEntity(text: string, anchors: EntityAnchors): boolean {
  return anchors.all.some((name) => nameRegex(name).test(text));
}

export function isHardAnchor(text: string, anchors: EntityAnchors): boolean {
  return hasAnchoredEntity(text, anchors);
}

/**
 * Soft anchor: a capitalised token that survives every blocklist. Used where a single sentence must
 * name someone but the window may still be one message long (facts and episodes in a fresh chat).
 */
export function hasNameLikeToken(text: string): boolean {
  NAME_TOKEN_RE.lastIndex = 0;
  for (let match = NAME_TOKEN_RE.exec(text); match; match = NAME_TOKEN_RE.exec(text)) {
    if (!isBlocked(match[1])) return true;
  }
  return false;
}

/** Name-like check for a fact subject: a known name, or a single capitalised non-blocked token. */
export function isNameLikeSubject(subject: string, anchors: EntityAnchors): boolean {
  const trimmed = subject.trim();
  if (!trimmed) return false;
  if (anchors.keys.has(normalizeToken(trimmed))) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length !== 1) return false;
  return !isBlocked(tokens[0]);
}

export { isBlocked as isBlockedNameToken };
