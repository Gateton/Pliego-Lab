// NPC Tracker prompt injection — independent of Roleplay. Scores the per-chat roster against the
// recent scene text and injects only the relevant NPCs so the model keeps their established
// appearance/personality consistent. Pure, no network.

import { extractKeywords } from "./keywords.ts";
import { t, translatedValues } from "../i18n/index.ts";
import * as charactersApi from "../api/characters.ts";
import type { TranslationKey } from "../i18n";
import type { NpcField, NpcRecord, NpcTrackerSettings } from "../types/npcTracker";

const MAX_INJECTED = 5;

/** A built-in dossier field: instead of the label itself it carries the catalog key, resolved with
 * `t()` where the field is displayed or persisted, so the defaults follow the interface language. */
export type DefaultNpcField = Omit<NpcField, "label"> & { labelKey: TranslationKey };

/** The built-in dossier fields (name is implicit — always the header). */
export const DEFAULT_NPC_FIELDS: DefaultNpcField[] = [
  { key: "appearance", labelKey: "npc.builtinFields.appearance", kind: "textarea", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
  { key: "personality", labelKey: "npc.builtinFields.personality", kind: "textarea", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
  { key: "role", labelKey: "npc.builtinFields.role", kind: "text", builtin: true, sharedWithCharacterCard: true, evolveMode: "replace" },
  { key: "background", labelKey: "npc.builtinFields.background", kind: "textarea", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
  { key: "speechStyle", labelKey: "npc.builtinFields.speechStyle", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "exampleLines", labelKey: "npc.builtinFields.exampleLines", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "motivation", labelKey: "npc.builtinFields.motivation", kind: "textarea", builtin: true, evolveMode: "replace" },
  { key: "logline", labelKey: "npc.builtinFields.logline", kind: "text", builtin: true, evolveMode: "replace" },
  { key: "defaultStanceToStranger", labelKey: "npc.builtinFields.defaultStanceToStranger", kind: "textarea", builtin: true, evolveMode: "replace" },
  { key: "secrets", labelKey: "npc.builtinFields.secrets", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "mannerisms", labelKey: "npc.builtinFields.mannerisms", kind: "textarea", builtin: true, evolveMode: "append" },
  { key: "narrativeLimits", labelKey: "npc.builtinFields.narrativeLimits", kind: "textarea", builtin: true, evolveMode: "replace" },
  { key: "imageTags", labelKey: "npc.builtinFields.imageTags", kind: "tags", builtin: true, sharedWithCharacterCard: true, evolveMode: "append" },
];

/** The roster avatar to show for an NPC: its own `pfp` if set, otherwise — for the chat's own
 * {{char}} entry — the Character Card's avatar (same person, no "two competing versions" issue
 * an image doesn't have the way appearance/personality text would). Never persisted; computed
 * at render time so it stays in sync if the card's avatar changes later. */
/** Field key → the catalog key of its label, for the fields the app seeds. */
const BUILTIN_LABEL_KEYS = new Map<string, TranslationKey>(DEFAULT_NPC_FIELDS.map((field) => [field.key, field.labelKey]));

/**
 * The label to show for a dossier field.
 *
 * A built-in field's label belongs to the app, but it is stored with the user's settings, so an
 * install created in Spanish keeps "Apariencia" in the file — and showed it in the middle of an
 * English interface. When the stored label still matches what the app seeded (in any language), the
 * current language wins. A label the user typed themselves is theirs and is never overridden.
 */
export function npcFieldLabel(field: NpcField): string {
  const key = BUILTIN_LABEL_KEYS.get(field.key);
  if (!key) return field.label;
  return translatedValues(key).includes(field.label) ? t(key) : field.label;
}

export function getNpcAvatarUrl(
  npc: Pick<NpcRecord, "pfp" | "isMainCharacter">,
  characterId?: string | null,
  /** Longest side in px for the fallback to the main character's art, which is only ever shown small. */
  size = 96,
): string | undefined {
  if (npc.pfp) return npc.pfp;
  if (npc.isMainCharacter && characterId) return charactersApi.thumbnailUrl(characterId, size);
  return undefined;
}

function serializeNpc(npc: NpcRecord): string {
  return [npc.name, ...Object.values(npc.values)].filter(Boolean).join(" ");
}

/**
 * Normalizes persisted NPCs into the current shape. Older NPCs were stored either with a
 * `values` map (Roleplay NPC Bank / early tracker) or with flat typed fields
 * (appearance/role/... + extras). This migrates the flat shape into `values` so every consumer
 * can assume the current `NpcRecord`. Already-normalized entries pass through untouched.
 */
export function normalizeNpcs(raw: unknown): NpcRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): NpcRecord => {
    const n = entry as Record<string, unknown>;
    const name = typeof n.name === "string" ? n.name : "";
    const id = typeof n.id === "string" ? n.id : crypto.randomUUID();
    const pfp = typeof n.pfp === "string" ? n.pfp : undefined;
    const firstSeen = typeof n.firstSeen === "number" ? n.firstSeen : undefined;
    const base = { id, name, ...(pfp ? { pfp } : {}), ...(firstSeen != null ? { firstSeen } : {}) };

    if (n.values && typeof n.values === "object") {
      return { ...base, values: n.values as Record<string, string> };
    }

    // Legacy flat shape
    const values: Record<string, string> = {};
    for (const key of ["appearance", "imageTags", "personality", "role", "background"]) {
      const v = n[key];
      if (typeof v === "string" && v) values[key] = v;
    }
    const extras = n.extras;
    if (extras && typeof extras === "object") {
      for (const [k, v] of Object.entries(extras as Record<string, unknown>)) {
        if (typeof v === "string" && v) values[k] = v;
      }
    }
    return { ...base, values };
  });
}

/**
 * Scores NPCs by keyword overlap against `text` (name matches weighted higher than a mention
 * buried in a dossier field). Shared by the main-prompt injection macro and the Image Director's
 * relevance filter. Returns only NPCs with score > 0, sorted best-first.
 */
export function scoreNpcRelevance(npcs: NpcRecord[], text: string): Array<{ npc: NpcRecord; score: number }> {
  const keywords = extractKeywords(text);
  if (!keywords.length) return [];

  return npcs
    .map((n) => {
      const npcText = serializeNpc(n).toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        const k = kw.toLowerCase();
        if (npcText.includes(k)) score += 1;
        if (n.name.toLowerCase().includes(k)) score += 6;
      }
      return { npc: n, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** NPCs explicitly @mentioned in `text` (literal "@Name" substring, case-insensitive) — used to
 * force them into context/turn-priority regardless of the automatic relevance score. */
export function extractMentionedNpcs(text: string, npcs: NpcRecord[]): NpcRecord[] {
  const lower = text.toLowerCase();
  return npcs.filter((n) => n.name && lower.includes(`@${n.name.toLowerCase()}`));
}

export function buildNpcTrackerMacro(
  settings: NpcTrackerSettings | null,
  npcs: NpcRecord[],
  chatText: string,
  mentionedNpcs: NpcRecord[] = [],
): string {
  if (!settings?.enabled || !npcs.length) return "";

  const scored = scoreNpcRelevance(npcs, chatText);
  const scoredIds = new Set(scored.map((s) => s.npc.id));
  const forced = mentionedNpcs.filter((n) => !scoredIds.has(n.id)).map((npc) => ({ npc, score: Infinity }));
  const combined = [...forced, ...scored].slice(0, MAX_INJECTED);

  if (!combined.length) return "";

  const entries = combined
    .map(({ npc: n }) => {
      const lines = [`Name: ${n.name}`];
      for (const f of settings.fields) {
        const v = n.values[f.key];
        if (v) lines.push(`${f.label}: ${v}`);
      }
      return `<${n.name}>\n${lines.join("\n")}\n</${n.name}>`;
    })
    .join("\n");

  const forcedTurnNote = mentionedNpcs.length
    ? `\n\n[FORCED TURN] The user explicitly mentioned ${mentionedNpcs.map((n) => n.name).join(" and ")} — make sure they get a visible line of dialogue or action in this reply.`
    : "";

  // If the protagonist's own NPC entry made it into this batch AND has any of the
  // Card-owned fields filled (appearance/personality/role/background/imageTags — only
  // possible once evolution or a later scan has touched them), the model now sees two
  // descriptions of the same person in the same prompt. Tell it which one is current.
  const sharedKeys = new Set(settings.fields.filter((f) => f.sharedWithCharacterCard).map((f) => f.key));
  const mainCharEntry = combined.find(
    ({ npc }) => npc.isMainCharacter && Object.entries(npc.values).some(([k, v]) => sharedKeys.has(k) && v),
  );
  const precedenceNote = mainCharEntry
    ? `\n\nNote: ${mainCharEntry.npc.name}'s entry in this list reflects their CURRENT/evolved version across the story. If it differs from their original Character Card, this version wins — the Card is the starting point, not the final state.`
    : "";

  return `[KNOWN NPCs — keep their appearance and personality consistent with these established details]\n<retrieved_npcs>\n${entries}\n</retrieved_npcs>${forcedTurnNote}${precedenceNote}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function isKnownName(candidate: string, knownNames: string[]): boolean {
  const lower = normalizeName(candidate);
  return knownNames.some((known) => {
    const k = normalizeName(known);
    return k === lower || k.startsWith(lower) || lower.startsWith(k);
  });
}

/** Case-insensitive, prefix-tolerant NPC lookup by name — same matching rule as isKnownName. */
export function findNpcByName(npcs: NpcRecord[], name: string): NpcRecord | undefined {
  const lower = normalizeName(name);
  return (
    npcs.find((n) => normalizeName(n.name) === lower) ??
    npcs.find((n) => normalizeName(n.name).startsWith(lower) || lower.startsWith(normalizeName(n.name)))
  );
}

// Mid-sentence capitalized words (Á-Ý range covers accented Spanish capitals) — NOT preceded by
// sentence-ending punctuation, so sentence-initial capitals (which say nothing about a name) are
// skipped for free by requiring a lowercase/comma/colon/semicolon right before the whitespace run.
const MID_SENTENCE_CAP_RE = /[a-zà-ÿñ,;:]\s+([A-ZÀ-ÝÑ][a-zà-ÿñ]{2,})\b/gu;

/**
 * Zero-cost (no LLM) gate for the NPC scan: does this text contain a plausible NEW character
 * name not already known? Pure heuristic (capitalization pattern), meant only to decide whether
 * the (already cheap, incremental) LLM scan is worth running this turn — false positives just
 * cost one extra scan, false negatives just fall back to the existing manual/interval scan.
 */
export function detectPossibleNewName(text: string, existingNpcs: NpcRecord[], excludeNames: string[]): boolean {
  if (!text) return false;
  const known = [...existingNpcs.map((n) => n.name), ...excludeNames].filter(Boolean);
  for (const match of text.matchAll(MID_SENTENCE_CAP_RE)) {
    const candidate = match[1];
    if (candidate && !isKnownName(candidate, known)) return true;
  }
  return false;
}
