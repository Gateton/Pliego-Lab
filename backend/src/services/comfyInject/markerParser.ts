// Port of comfyinject3.0/src/parse.js — pure marker classification, no I/O.
// The marker format `[[IMG: prompt | AR | SHOT | SEED]]` is a recommendation, not a hard
// rule: this scans every pipe-separated segment and salvages exact uppercase control
// tokens from whole segments, comma parts, and words, leaving everything else as prompt
// text. See the original for the full rationale — ported here line-for-line in intent.

const VALID_AR = new Set(["PORTRAIT", "SQUARE", "LANDSCAPE", "CINEMA"]);
const VALID_SHOT = new Set([
  "CLOSE",
  "MEDIUM",
  "WIDE",
  "DUTCH",
  "OVERHEAD",
  "LOWANGLE",
  "HIGHANGLE",
  "PROFILE",
  "BACKVIEW",
  "POV",
]);

const DEFAULT_AR = "SQUARE";
const DEFAULT_SHOT = "MEDIUM";
const DEFAULT_SEED = "RANDOM";

export const MARKER_REGEX = /\[\[IMG:\s*(.+?)\s*\]\]/s;
export const MARKER_REGEX_GLOBAL = /\[\[IMG:\s*(.+?)\s*\]\]/gs;

export function hasImageMarker(text: string): boolean {
  return MARKER_REGEX.test(text);
}

function isArToken(value: string): boolean {
  return VALID_AR.has(value);
}

function isShotToken(value: string): boolean {
  return VALID_SHOT.has(value);
}

function isSeedToken(value: string): boolean {
  return value === "RANDOM" || value === "LOCK" || /^\d+$/.test(value);
}

type TokenType = "AR" | "SHOT" | "SEED";

function classifyToken(value: string): TokenType | null {
  if (isArToken(value)) return "AR";
  if (isShotToken(value)) return "SHOT";
  if (isSeedToken(value)) return "SEED";
  return null;
}

export interface RepairMeta {
  defaulted: string[];
  duplicateTokens: { AR: string[]; SHOT: string[]; SEED: string[] };
  possibleSeedInPrompt: boolean;
}

function createRepairMeta(): RepairMeta {
  return {
    defaulted: [],
    duplicateTokens: { AR: [], SHOT: [], SEED: [] },
    possibleSeedInPrompt: false,
  };
}

interface ParserState {
  ar: string | null;
  shot: string | null;
  seedToken: string | null;
}

function recordToken(state: ParserState, type: TokenType, value: string, repairMeta: RepairMeta): void {
  if (type === "AR") {
    if (state.ar === null) state.ar = value;
    else repairMeta.duplicateTokens.AR.push(value);
    return;
  }
  if (type === "SHOT") {
    if (state.shot === null) state.shot = value;
    else repairMeta.duplicateTokens.SHOT.push(value);
    return;
  }
  if (state.seedToken === null) state.seedToken = value;
  else repairMeta.duplicateTokens.SEED.push(value);
}

function hasPossibleSeedInPrompt(prompt: string): boolean {
  return /\b\d{4,}\b/.test(prompt);
}

// Word level: only exact uppercase control tokens are consumed. Numeric seeds are NOT
// consumed here, so numbers inside prompt-like text stay part of the prompt.
function processWord(word: string, state: ParserState, repairMeta: RepairMeta): string {
  let type: TokenType | null = null;
  if (isArToken(word)) type = "AR";
  else if (isShotToken(word)) type = "SHOT";
  else if (word === "RANDOM" || word === "LOCK") type = "SEED";

  if (!type) return word;
  recordToken(state, type, word, repairMeta);
  return "";
}

function processCommaPart(part: string, state: ParserState, repairMeta: RepairMeta): string {
  const trimmed = part.trim();
  if (!trimmed) return "";

  const wholeType = classifyToken(trimmed);
  if (wholeType) {
    recordToken(state, wholeType, trimmed, repairMeta);
    return "";
  }
  if (/^\d+$/.test(trimmed)) {
    recordToken(state, "SEED", trimmed, repairMeta);
    return "";
  }

  const leftoverWords: string[] = [];
  for (const word of trimmed.split(/\s+/).filter(Boolean)) {
    const leftover = processWord(word, state, repairMeta);
    if (leftover) leftoverWords.push(leftover);
  }
  return leftoverWords.join(" ");
}

function processSegment(segment: string, state: ParserState, repairMeta: RepairMeta): string {
  const trimmed = segment.trim();
  if (!trimmed) return "";

  const wholeType = classifyToken(trimmed);
  if (wholeType) {
    recordToken(state, wholeType, trimmed, repairMeta);
    return "";
  }
  if (/^\d+$/.test(trimmed)) {
    recordToken(state, "SEED", trimmed, repairMeta);
    return "";
  }

  const leftoverParts: string[] = [];
  for (const part of trimmed.split(",")) {
    const leftover = processCommaPart(part, state, repairMeta);
    if (leftover) leftoverParts.push(leftover);
  }
  return leftoverParts.join(", ");
}

export type ParsedMarker =
  | { status: "ok"; prompt: string; ar: string; shot: string; seedToken: string; repairMeta: RepairMeta }
  | { status: "parse_error"; reason: string; repairMeta: RepairMeta };

/** Parses one marker's inner content. Seed is returned as an unresolved token (RANDOM/LOCK/digits) — resolving it against chat history is seedState's job. */
export function parseMarkerContent(innerContent: string): ParsedMarker {
  const repairMeta = createRepairMeta();
  if (!innerContent.trim()) {
    return { status: "parse_error", reason: "empty_marker", repairMeta };
  }

  const state: ParserState = { ar: null, shot: null, seedToken: null };
  const promptSegments: string[] = [];

  for (const rawSegment of innerContent.split("|")) {
    const leftover = processSegment(rawSegment, state, repairMeta);
    if (leftover) promptSegments.push(leftover);
  }

  // Pipes are marker syntax only — leftover text from different segments becomes one prompt.
  const prompt = promptSegments.join(", ").trim();
  if (!prompt) {
    return { status: "parse_error", reason: "empty_prompt", repairMeta };
  }
  if (hasPossibleSeedInPrompt(prompt)) repairMeta.possibleSeedInPrompt = true;

  let ar = state.ar;
  let shot = state.shot;
  let seedToken = state.seedToken;

  if (ar === null) {
    ar = DEFAULT_AR;
    repairMeta.defaulted.push("AR");
  }
  if (shot === null) {
    shot = DEFAULT_SHOT;
    repairMeta.defaulted.push("SHOT");
  }
  if (seedToken === null) {
    seedToken = DEFAULT_SEED;
    repairMeta.defaulted.push("SEED");
  }

  return { status: "ok", prompt, ar, shot, seedToken, repairMeta };
}

/** Parses a single raw `[[IMG: ...]]` marker string — used by the retry flow. */
export function parseSingleMarker(rawMarker: string): ParsedMarker {
  const match = (rawMarker || "").match(MARKER_REGEX);
  if (!match) {
    return { status: "parse_error", reason: "invalid_marker", repairMeta: createRepairMeta() };
  }
  return parseMarkerContent(match[1]);
}
