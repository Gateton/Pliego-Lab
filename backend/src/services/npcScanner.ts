// NPC Tracker scanner — LLM extraction of every named NPC from the chat, merged non-destructively
// into the per-chat roster. The field list is fully configurable (built-in + custom); the model is
// asked for each field by key, and results land in `NpcRecord.values` keyed by field key. Uses
// OpenRouter in JSON mode and parses tolerantly. Auto-matches each new NPC to the first generated
// image whose prompt mentions them (or shares strong tag overlap).

import { randomUUID } from "node:crypto";
import { completeJson, type ChatMessage, type GenerationMeta, type NormalizedUsage } from "./llm.js";
import type { NpcRecord, NpcField, NpcFieldKind } from "../types.js";

export interface ScanImage {
  prompt: string;
  url: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function matchExisting(npcs: NpcRecord[], name: string): NpcRecord | undefined {
  const lower = normalizeName(name);
  return (
    npcs.find((n) => normalizeName(n.name) === lower) ??
    npcs.find((n) => normalizeName(n.name).startsWith(lower) || lower.startsWith(normalizeName(n.name)))
  );
}

/** Migrates persisted NPCs written by earlier shapes (flat typed fields) into the current values map. */
function normalizeExistingNpcs(npcs: NpcRecord[]): NpcRecord[] {
  return npcs.map((npc) => {
    const n = npc as unknown as Record<string, unknown>;
    if (n.values && typeof n.values === "object") return npc;
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
    return { id: npc.id, name: npc.name, values, ...(npc.pfp ? { pfp: npc.pfp } : {}), ...(npc.firstSeen != null ? { firstSeen: npc.firstSeen } : {}) };
  });
}

function cleanField(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\[\.\.\.\]$/.test(trimmed) ? "" : trimmed;
}

/** Tolerant JSON parse shared by every NPC Tracker LLM call: strip code fences, take the
 * outermost { ... } object. Models don't always honour response_format exactly. */
function parseOuterJsonObject(content: string): Record<string, unknown> | null {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseJsonContent(content: string): { npcs: unknown[] } | null {
  return parseOuterJsonObject(content) as { npcs: unknown[] } | null;
}

function tagOverlap(a: string, b: string): number {
  const as = new Set(a.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
  const bs = new Set(b.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (!as.size || !bs.size) return 0;
  let inter = 0;
  for (const t of as) if (bs.has(t)) inter++;
  return inter / Math.min(as.size, bs.size);
}

function matchPfp(imageTags: string, name: string, images: ScanImage[]): string | undefined {
  const nameLower = name.toLowerCase();
  let best: { url: string; score: number } | undefined;
  for (const img of images) {
    const p = img.prompt.toLowerCase();
    if (nameLower && p.includes(nameLower)) return img.url;
    const overlap = tagOverlap(imageTags, img.prompt);
    if (!best || overlap > best.score) best = { url: img.url, score: overlap };
  }
  return best && best.score >= 0.3 ? best.url : undefined;
}

export interface MainCharacterCard {
  description: string;
  personality: string;
  scenario: string;
  imageTags: string;
}

/** Shared instruction for any "tags"-kind field (imageTags) — used by the scan, regenerate, and
 * persona-dossier prompts alike. Explicitly pushes for specificity/distinctiveness: the observed
 * failure mode isn't too few tags in the abstract, it's every character converging on the same
 * generic 4-5 tag template (hair color, eye color, skin, build) regardless of how visually
 * distinctive they actually are. */
function buildTagsFieldInstruction(key: string, label: string): string {
  return `- "${key}" (${label}): comma-separated Danbooru/Booru tags, separated by SPACES within each tag (e.g. "long hair", never "long_hair"), PHYSICAL ONLY, in this exact order: hair (color + length + style: bangs, ponytail, twin tails, hime cut, braids, etc.) → eyes (color + shape) → face (shape/nose/lips/brows, only if distinctive) → skin/body (tone, build, bust, permanent marks — scars, birthmarks, tattoos, unusual eye patterns) → race/species (ONLY if non-human — elf ears, horns, tail, wings, etc.; omit entirely for humans, never write "human").
No clothes/pose/background/expression — this includes worn accessories (headbands, hats, jewelry, collars, forehead protectors) and any transient state (blushing, nervous, trembling, current pose, gaze direction, mood). If it isn't a PERMANENT physical trait, it doesn't belong here — it degrades identity anchoring instead of adding detail.
Typically 10-16 tags is enough — never pad past what the character's genuine permanent traits support just to hit a higher count; a short accurate list beats a long one padded with pose/clothes/mood.
Be SPECIFIC and DISTINCTIVE — two different tracked characters should never share hair+eye color without at least one added distinguishing mark (scar, unusual pattern, birthmark) to tell them apart. "hair" alone is almost never one tag, it needs color + length + a style word.
DO NOT stop at only what the current conversation happens to mention. If this is a character you recognize from an existing series, actively DRAW ON that knowledge to fill out the FULL physical picture (eye color, exact build, skin tone, signature marks, race) even if the excerpt itself never states them — the conversation is a trigger to identify who they are, not a ceiling on how much you're allowed to describe. For an original/unknown character, reasonably infer the rest of a coherent physical description from what IS given (a character described as "delicate" plausibly has a slender build; someone "battle-worn" plausibly has visible scars) rather than leaving those tags out entirely.
Determine this character's race BEFORE listing tags, cross-referencing everything already known about them (background/role/personality, not just this excerpt) — human needs no species tag; non-human (elf, demon, succubus, etc.) MUST include its defining physical marker(s) among the tags, every time, even if the current excerpt never mentions it.`;
}

/** Category order the image pipeline expects `imageTags` pre-sorted into — see the reordering
 * step below, which enforces this deterministically in code instead of trusting the model to
 * keep it sorted across incremental `evolve` appends. Order matches the Image Director's own
 * tag-chain slots (HAIR/EYES/FACE/SKIN·BODY/SPECIES). */
const TAG_CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: "hair", keywords: ["hair", "bang", "ponytail", "twin tail", "braid", "updo", "ahoge", "sidelock", "hime cut"] },
  { category: "eyes", keywords: ["eye", "pupil", "sclera", "heterochromia"] },
  { category: "face", keywords: ["face", "nose", "lip", "brow", "eyelash", "jaw", "chin", "cheek", "freckle"] },
  {
    category: "skin/body",
    keywords: ["skin", "tone", "tan", "pale", "bust", "breast", "waist", "body", "build", "height", "scar", "birthmark", "tattoo", "mole", "bruise"],
  },
  { category: "species", keywords: ["ear", "tail", "horn", "wing", "fang", "scale", "claw", "elf", "demon", "kitsune"] },
];

/** Classifies one tag into its category bucket via simple keyword matching — "other" is the
 * fallback for anything unrecognized, so a tag is NEVER dropped, only left in relative order at
 * the end of the string. */
function categorizeTag(tag: string): string {
  const lower = tag.toLowerCase();
  for (const { category, keywords } of TAG_CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "other";
}

/** Closed, low-ambiguity vocabularies that are auto-stripped from `imageTags` (unlike the
 * category buckets above, used only for ordering) — real production data (2026-09-12 audit)
 * showed the model repeatedly ignoring the "no clothes/pose/expression" prose rule under
 * pressure to hit a higher tag count, e.g. "oversized white tee", "black choker", "kneeling",
 * "arms crossed", "jealous expression" all landing in a dossier's imageTags. Unlike species
 * words (e.g. "ear", which can be a legitimate identity trait on a hybrid character), garment
 * nouns and pose/expression words are essentially NEVER a valid physical-identity tag, so
 * stripping them outright carries far less false-positive risk. */
const STRIP_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  {
    label: "clothing/accessory",
    keywords: [
      "shirt", "tee", "top", "blouse", "dress", "skirt", "shorts", "pants", "jeans", "choker", "collar", "necklace",
      "bracelet", "earring", "bra", "panties", "underwear", "bikini", "robe", "cloak", "cape", "armor", "jacket",
      "coat", "boots", "shoes", "socks", "stockings", "thighhighs", "gloves", "hat", "hood", "veil", "scarf", "belt",
      "corset", "lingerie", "swimsuit", "uniform", "fabric", "lace", "clothes", "clothing", "garment", "outfit",
      "nude", "barefoot", "bare",
    ],
  },
  {
    label: "pose/action/gaze",
    keywords: [
      "kneeling", "standing", "sitting", "crouching", "lying down", "running", "walking", "crossed", "fidgeting",
      "trembling", "shaking", "biting lip", "looking down", "looking up", "looking away", "looking at viewer",
      "posture", "gesture", "grin", "smirk", "gaze",
    ],
  },
  {
    label: "expression/mood",
    keywords: [
      "expression", "blush", "blushing", "flushed", "nervous", "jealous", "shy", "submissive", "dominant", "aggressive",
      "smiling", "frowning", "crying", "happy", "sad", "angry", "scared", "surprised", "smug", "aroused",
      "exhausted", "determined", "tsundere", "mischievous", "playful", "cute",
    ],
  },
];

/** Word-boundary match for single-word keywords (so "cap" never matches inside "kneecap"),
 * plain substring match for multi-word phrases (a phrase accidentally appearing inside a
 * legitimate tag is not a realistic risk). */
function tagMatchesKeyword(tagLower: string, keyword: string): boolean {
  if (keyword.includes(" ")) return tagLower.includes(keyword);
  return new RegExp(`\\b${keyword}\\b`).test(tagLower);
}

/** Removes tags matching the closed clothing/pose/expression vocabularies above — actual
 * enforcement, not just a warning, since (unlike species words) these are safe to hard-filter.
 * Nothing disappears silently: every removal is logged with which tag and which category. */
function stripNonPhysicalTags(value: string, subjectName: string): string {
  const tags = value.split(",").map((t) => t.trim()).filter(Boolean);
  const kept: string[] = [];
  const stripped: Array<{ tag: string; label: string }> = [];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    const hit = STRIP_KEYWORDS.find(({ keywords }) => keywords.some((kw) => tagMatchesKeyword(lower, kw)));
    if (hit) stripped.push({ tag, label: hit.label });
    else kept.push(tag);
  }
  if (stripped.length > 0) {
    console.warn(
      `[NPC Tracker] stripped non-physical tag(s) from imageTags for "${subjectName}": ${stripped.map((s) => `"${s.tag}" (${s.label})`).join(", ")}`,
    );
  }
  return kept.join(", ");
}

/** Deterministic, LLM-free reordering of an `imageTags` value into the canonical category
 * sequence (hair → eyes → face → skin/body → species → other), preserving each tag's relative
 * order within its own bucket. Runs on every save (scan/regenerate/evolve-merge/consolidate/
 * persona) so the field stays sorted even as `evolve` appends new tags onto the end over time —
 * relying on the model alone to keep it sorted doesn't survive many incremental appends. */
function reorderImageTags(value: string): string {
  const tags = value.split(",").map((t) => t.trim()).filter(Boolean);
  const order = ["hair", "eyes", "face", "skin/body", "species", "other"];
  const buckets = new Map<string, string[]>(order.map((c) => [c, []]));
  for (const tag of tags) {
    buckets.get(categorizeTag(tag))!.push(tag);
  }
  return order.flatMap((c) => buckets.get(c)!).join(", ");
}

/** Non-blocking sanity checks over a saved `imageTags` value — returns human-readable warnings
 * for logging only. Never mutates or rejects the value: a keyword-based check is too blunt to
 * safely auto-correct (e.g. flagging every "ear" tag would also flag a legitimate catgirl's
 * "cat ears"), so this is visibility for manual review, not enforcement. */
function validateImageTags(value: string): string[] {
  const tags = value.split(",").map((t) => t.trim()).filter(Boolean);
  const warnings: string[] = [];
  if (tags.length > 0 && (tags.length < 6 || tags.length > 24)) {
    warnings.push(`unusual tag count (${tags.length}, expected roughly 10-16)`);
  }
  const lower = tags.map((t) => t.toLowerCase());
  const dupes = lower.filter((t, i) => lower.indexOf(t) !== i);
  if (dupes.length > 0) warnings.push(`duplicate tag(s): ${[...new Set(dupes)].join(", ")}`);
  const underscored = tags.filter((t) => t.includes("_"));
  if (underscored.length > 0) warnings.push(`underscore formatting instead of spaces: ${underscored.join(", ")}`);
  const categories = new Set(tags.map(categorizeTag));
  for (const required of ["hair", "eyes", "skin/body"]) {
    if (!categories.has(required)) warnings.push(`no "${required}" tag found`);
  }
  return warnings;
}

/** Shared post-processing for any `imageTags` value right before it's persisted: strip
 * clothing/pose/expression leaks, reorder into the canonical category sequence, and log (never
 * block on) any remaining sanity-check warnings. */
function finalizeImageTags(value: string, subjectName: string): string {
  if (!value) return value;
  const stripped = stripNonPhysicalTags(value, subjectName);
  const reordered = reorderImageTags(stripped);
  const warnings = validateImageTags(reordered);
  if (warnings.length > 0) {
    console.warn(`[NPC Tracker] imageTags warning for "${subjectName}": ${warnings.join("; ")}`);
  }
  return reordered;
}

function buildSystemPrompt(fields: NpcField[], mainCharacterName?: string, hasMainCharacterCard?: boolean): string {
  const fieldLines = fields.map((f) =>
    f.kind === "tags"
      ? buildTagsFieldInstruction(f.key, f.label)
      : `- "${f.key}" (${f.label}): as much concrete, specific detail as the conversation actually supports — don't pad, but don't force it short either.`,
  );
  const shape = `{"npcs":[{"name":"...",${fields.map((f) => `"${f.key}":"..."`).join(",")}}]}`;

  if (!mainCharacterName) {
    return [
      "You are an NPC extraction engine for a roleplay story. Extract every NAMED character who actually appears and speaks or acts in the conversation, except the protagonist's main partner and the user themselves.",
      "Return ONLY valid JSON, no prose, in this exact shape:",
      shape,
      "",
      "For each NPC include exactly these fields:",
      ...fieldLines,
      "- Skip unnamed, one-line, or set-dressing characters (a passing guard, a cashier, a crowd).",
      "- UNIQUENESS: if two NPCs you're extracting in THIS SAME response would otherwise end up with the same hair color AND eye color, add at least one distinguishing mark to each (a scar, an unusual pattern, a birthmark) so they stay visually distinct — never submit two identical-looking NPCs in the same batch.",
      '- If no NPCs qualify, return {"npcs":[]}.',
    ].join("\n");
  }

  const sharedKeys = new Set(fields.filter((f) => f.sharedWithCharacterCard).map((f) => f.key));
  const cardFieldLines = fieldLines.filter((_, i) => sharedKeys.has(fields[i].key));
  const portabilityLines = fieldLines.filter((_, i) => !sharedKeys.has(fields[i].key));
  const mainCharacterInstructions = hasMainCharacterCard
    ? [
        `ALSO include an entry for "${mainCharacterName}" (the protagonist) — fill in EVERY field below for them, but the source differs by field:`,
        "- These fields come ONLY from the \"Protagonist's Character Card\" block given in the user message — NEVER from the conversation, and never invent beyond what the card actually supports (leave a field empty if the card doesn't cover it):",
        ...cardFieldLines,
        "- These fields come from the conversation, same as for any other character:",
        ...portabilityLines,
      ]
    : [
        `ALSO include an entry for "${mainCharacterName}" (the protagonist) — but for THEM ONLY, fill in these fields (their appearance/personality/background/role/image tags already live elsewhere and must NOT be duplicated here — leave those as empty strings, always, no matter how well the conversation supports them):`,
        ...portabilityLines,
      ];
  return [
    "You are an NPC extraction engine for a roleplay story. Extract every NAMED character who actually appears and speaks or acts in the conversation, except the user themselves.",
    ...mainCharacterInstructions,
    "Return ONLY valid JSON, no prose, in this exact shape:",
    shape,
    "",
    "For every OTHER NPC (not the protagonist), include exactly these fields:",
    ...fieldLines,
    "- Skip unnamed, one-line, or set-dressing characters (a passing guard, a cashier, a crowd) — this does not apply to the protagonist, always include them.",
    "- UNIQUENESS: if two NPCs you're extracting in THIS SAME response would otherwise end up with the same hair color AND eye color, add at least one distinguishing mark to each (a scar, an unusual pattern, a birthmark) so they stay visually distinct — never submit two identical-looking NPCs in the same batch.",
    '- If no NPCs qualify besides the protagonist, still return them alone in "npcs".',
  ].join("\n");
}

export interface ScanResult {
  npcs: NpcRecord[];
  added: number;
  updated: number;
  usage: NormalizedUsage;
  meta: GenerationMeta;
}

export async function scanForNpcs(opts: {
  text: string;
  characterName: string;
  personaName?: string;
  model?: string;
  fields: NpcField[];
  existingNpcs: NpcRecord[];
  images: ScanImage[];
  firstMessageIndex: number;
  includeMainCharacter?: boolean;
  mainCharacterCard?: MainCharacterCard;
}): Promise<ScanResult> {
  const { text, characterName, personaName, model, fields, existingNpcs, images, firstMessageIndex, includeMainCharacter, mainCharacterCard } = opts;

  const excluded = [includeMainCharacter ? undefined : characterName, personaName]
    .filter((s): s is string => Boolean(s))
    .map(normalizeName);
  const mainCharacterName = includeMainCharacter ? characterName || undefined : undefined;
  const cardBlock =
    mainCharacterName && mainCharacterCard
      ? [
          "",
          `Protagonist's Character Card (use ONLY this for ${mainCharacterName}'s appearance/personality/role/background/image tags — never the conversation, never invent beyond it):`,
          mainCharacterCard.description ? `Description: ${mainCharacterCard.description}` : "",
          mainCharacterCard.personality ? `Personality: ${mainCharacterCard.personality}` : "",
          mainCharacterCard.scenario ? `Scenario: ${mainCharacterCard.scenario}` : "",
          mainCharacterCard.imageTags ? `Image tags: ${mainCharacterCard.imageTags}` : "",
        ].filter((s) => s !== "")
      : [];
  const userPrompt = [
    mainCharacterName ? "" : `Main character (exclude): ${characterName || "the protagonist"}`,
    personaName ? `User (exclude): ${personaName}` : "",
    ...cardBlock,
    "",
    "Conversation:",
    text,
  ]
    .filter((s) => s !== "")
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(fields, mainCharacterName, !!mainCharacterCard) },
    { role: "user", content: userPrompt },
  ];

  // Multiple NPCs × the full field list (now 13, was 5) can genuinely need more than the
  // default budget in one pass — same truncation failure mode as regenerateNpcDossier, just
  // multiplied by however many characters show up in this chunk.
  const { content, usage, provider, model: usedModel } = await completeJson({ messages, model: model || undefined, maxTokens: 6000 }, new AbortController().signal);
  const meta: GenerationMeta = { provider, model: usedModel, usage };
  const parsed = parseJsonContent(content);
  if (!parsed || !Array.isArray(parsed.npcs)) {
    console.warn(`[NPC Tracker] scan: no usable JSON in response (likely truncated or malformed). Preview: ${content.slice(-300)}`);
    return { npcs: existingNpcs, added: 0, updated: 0, usage, meta };
  }

  const next: NpcRecord[] = normalizeExistingNpcs(existingNpcs).map((n) => ({ ...n, values: { ...n.values } }));
  let added = 0;
  let updated = 0;

  for (const raw of parsed.npcs as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") continue;
    const name = cleanField(raw.name);
    if (!name || excluded.includes(normalizeName(name))) continue;
    const isMain = !!mainCharacterName && normalizeName(name) === normalizeName(mainCharacterName);

    const values: Record<string, string> = {};
    for (const f of fields) {
      const v = cleanField(raw[f.key]);
      if (v) values[f.key] = v;
    }
    if (values["imageTags"]) values["imageTags"] = finalizeImageTags(values["imageTags"], name);
    const imageTags = values["imageTags"] ?? "";

    const existing = matchExisting(next, name);
    if (existing) {
      // Non-destructive: only fill empty fields, never overwrite established canon. For the
      // main character this now includes the Card-sourced fields too (appearance/personality/
      // role/background/imageTags) — safe because the model was told to source them ONLY from
      // the Character Card, not invent from the conversation, so there's nothing to overwrite.
      for (const f of fields) {
        if (!existing.values[f.key] && values[f.key]) existing.values[f.key] = values[f.key];
      }
      if (isMain) existing.isMainCharacter = true;
      if (!existing.pfp && !isMain) {
        const pfp = matchPfp(imageTags, name, images);
        if (pfp) existing.pfp = pfp;
      }
      updated++;
    } else {
      const pfp = isMain ? undefined : matchPfp(imageTags, name, images);
      next.push({
        id: randomUUID(),
        name,
        values,
        ...(pfp ? { pfp } : {}),
        ...(isMain ? { isMainCharacter: true } : {}),
        firstSeen: firstMessageIndex,
      });
      added++;
    }
  }

  return { npcs: next, added, updated, usage, meta };
}

function buildRegenerateSystemPrompt(fields: NpcField[]): string {
  const fieldLines = fields.map((f) =>
    f.kind === "tags"
      ? buildTagsFieldInstruction(f.key, f.label)
      : `- "${f.key}" (${f.label}): as much concrete, specific detail as the conversation actually supports.`,
  );
  const shape = `{"name":"...",${fields.map((f) => `"${f.key}":"..."`).join(",")}}`;
  return [
    "You are rewriting the FULL dossier for ONE specific named character from a roleplay conversation, from scratch — this is a deliberate regeneration the user asked for because they didn't like the previous version, not an incremental update.",
    "Read the ENTIRE conversation for everything relevant to this one character and write complete, well-grounded values for every field below.",
    "Return ONLY valid JSON, no prose, in this exact shape:",
    shape,
    "",
    "For each field:",
    ...fieldLines,
    "- If the conversation genuinely has nothing for a field, leave it as an empty string — never invent unsupported detail.",
  ].join("\n");
}

/** Full rewrite of ONE NPC's dossier from the whole conversation — unlike scanForNpcs, this
 * overwrites every field outright (the user explicitly asked to redo it), and only makes sense
 * run against the chat where the NPC actually has real narrative content: a copy imported via
 * Favoritos into an unrelated chat simply won't have anything for the model to find here. */
export async function regenerateNpcDossier(opts: {
  npcName: string;
  fullConversationText: string;
  fields: NpcField[];
  model?: string;
}): Promise<{ values: Record<string, string>; usage: NormalizedUsage; meta: GenerationMeta }> {
  const { npcName, fullConversationText, fields, model } = opts;
  const messages: ChatMessage[] = [
    { role: "system", content: buildRegenerateSystemPrompt(fields) },
    { role: "user", content: `Character to rewrite: ${npcName}\n\nConversation:\n${fullConversationText}` },
  ];
  // A full rewrite of every field for one character runs noticeably longer than the default
  // scan budget (verified against a real 12-field regeneration getting cut off mid-JSON at
  // the default 2000 tokens) — give it real headroom.
  const { content, usage, provider, model: usedModel } = await completeJson({ messages, model: model || undefined, maxTokens: 4000 }, new AbortController().signal);
  const meta: GenerationMeta = { provider, model: usedModel, usage };

  const parsed = parseOuterJsonObject(content);
  if (!parsed) {
    console.warn(`[NPC Tracker] regenerate: no usable JSON in response (likely truncated or malformed). Preview: ${content.slice(-300)}`);
    return { values: {}, usage, meta };
  }

  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = cleanField(parsed[f.key]);
    if (v) values[f.key] = v;
  }
  if (values["imageTags"]) values["imageTags"] = finalizeImageTags(values["imageTags"], npcName);
  return { values, usage, meta };
}

function evolveModeOf(f: NpcField): "append" | "replace" {
  return f.evolveMode ?? "replace";
}

function buildEvolveSystemPrompt(fields: NpcField[]): string {
  const fieldKeys = fields.map((f) => `"${f.key}"`).join(", ");
  const appendFields = fields.filter((f) => evolveModeOf(f) === "append");
  const replaceFields = fields.filter((f) => evolveModeOf(f) === "replace");
  const appendTextFields = appendFields.filter((f) => f.kind !== "tags");
  const appendTagsFields = appendFields.filter((f) => f.kind === "tags");

  return [
    "You are reviewing an ongoing roleplay story to see if any tracked character's dossier needs a genuine update based on what JUST happened in the recent conversation excerpt.",
    "You will be given each character's CURRENT dossier (name + their already-known field values) followed by the recent excerpt.",
    "Only report a character if something ACTUALLY, CONCRETELY changed or was revealed about them in the recent excerpt — a real shift in behavior, a new secret revealed, a change in how they speak, a new motivation, etc. Do NOT report a character just because they appeared or spoke normally, and do NOT rephrase or pad an existing value that's still accurate.",
    "Return ONLY valid JSON, no prose, in this exact shape:",
    '{"updates":[{"name":"...", "<only the field(s) that changed>":"..."}]}',
    `Valid field keys: ${fieldKeys}. Only include a field in an update object if its value genuinely needs to change — never repeat unchanged fields, never include a field with no real update.`,
    "",
    "FIELD SCOPE — put new information in the field it actually belongs to, never wherever is convenient:",
    '  "appearance" is PHYSICAL description ONLY (body, face, hair, clothing style, etc.) — a plot event, a relationship, or a change in circumstance is NEVER appearance content, even if it happened at the same time. If nothing about how they physically look changed, do NOT touch "appearance".',
    '  "personality" is character TRAITS ONLY (how she is, not what is currently happening to her). A new circumstance (reunited with someone, a status change, a recent event) belongs in "background" and/or "motivation" if those fields exist, never bolted onto "appearance" or "personality" as an afterthought.',
    "  Before writing to any field, ask: does this field's own definition actually cover this new information? If not, either put it in the field that does, or — if no field fits — leave it out entirely rather than forcing it into the nearest available field.",
    "",
    ...(appendTextFields.length > 0
      ? [
          `APPEND-ONLY FIELDS (${appendTextFields.map((f) => `"${f.key}"`).join(", ")}): these accumulate permanent facts over the whole story, and are handled specially — you never see or rewrite the full text. For these fields, your update value must be ONLY the new sentence(s) to ADD, describing exactly what's new/revealed this turn — a system appends it onto the existing value automatically. Do NOT restate, summarize, rephrase, or reference anything already in the dossier (you don't know its exact current wording) — write your addition as a clean, standalone statement of the new fact, as if starting a new sentence.`,
          "  Only report one of these fields when something genuinely new and DURABLE was revealed — a one-off scene detail, a passing mood, or something already implied doesn't count. If in doubt, leave it out.",
          "",
        ]
      : []),
    ...(appendTagsFields.length > 0
      ? [
          "KEEPING IMAGE TAGS IN SYNC (also append-only): whenever you add a NEW permanent, visually-distinguishing physical detail to an append-only text field like \"appearance\" (a scar, a new hairstyle, a missing limb, a tattoo, anything that changes what the character actually looks like), also report the matching NEW tag(s) for the tags field below, in the SAME update — image generation reads the tags field, not the prose one, so letting them fall out of sync means it keeps rendering an outdated look.",
          ...appendTagsFields.map(
            (f) =>
              `For "${f.key}" (${f.label}), your update value must be ONLY the new tag(s) to add (comma-separated) — never the existing tag list restated.\n${buildTagsFieldInstruction(f.key, f.label)}`,
          ),
          "Never add a tag for a passing/temporary detail (current pose, a torn sleeve exposing skin, mud on the face) — only for a genuinely permanent physical change.",
          "UNIQUENESS: you can see every tracked character's current dossier above — if a new tag you're about to add would make two of them share the exact same hair color AND eye color, add a distinguishing mark (scar, unusual pattern, birthmark) instead of, or in addition to, the plain color tag, so they stay visually distinct.",
          "",
        ]
      : []),
    ...(replaceFields.length > 0
      ? [
          `SNAPSHOT FIELDS (${replaceFields.map((f) => `"${f.key}"`).join(", ")}): unlike the append-only fields above, these describe a CURRENT state, not an accumulating history — you DO see their current value, and your update value is the FULL new value, replacing the old one entirely. Base it on the old value's substance where it's still true (don't invent an unrelated new snapshot) — only the parts the story actually changed should differ.`,
          "",
        ]
      : []),
    "A field's value must ALWAYS read as a direct, concrete statement about its subject — NEVER as commentary describing the update itself. Sentences like 'X remains the same, but...', 'Nothing changed except...', or any other meta-remark about whether/why the field changed are FORBIDDEN as field content — if nothing genuinely needs adding/changing for a field, don't include it in the update at all.",
    'If nobody genuinely changed, return {"updates":[]}.',
  ].join("\n");
}

export interface EvolveResult {
  npcs: NpcRecord[];
  changed: number;
  usage: NormalizedUsage;
  meta: GenerationMeta;
}

/** Appends new tags onto an existing tag list, de-duplicating case-insensitively — never drops
 * an existing tag, only adds ones not already present. */
function mergeTagLists(existing: string, addition: string): string {
  const existingTags = existing.split(",").map((t) => t.trim()).filter(Boolean);
  const existingLower = new Set(existingTags.map((t) => t.toLowerCase()));
  const newTags = addition
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !existingLower.has(t.toLowerCase()));
  return [...existingTags, ...newTags].join(", ");
}

/** Appends a new sentence/fragment onto existing prose, adding sentence-ending punctuation
 * first if the existing text is missing it, so the two don't run together illegibly. */
function mergeTextAppend(existing: string, addition: string): string {
  const trimmed = existing.trim();
  if (!trimmed) return addition;
  const needsPunctuation = !/[.!?]["')]?$/.test(trimmed);
  return `${trimmed}${needsPunctuation ? "." : ""} ${addition}`;
}

/** Separate, deliberately isolated path from scanForNpcs: this one CAN overwrite existing field
 * values when the model reports a genuine change, instead of only filling empty ones. Never
 * adds/removes NPCs, never touches pfp/firstSeen — only values.
 *
 * Fields marked evolveMode "append" are structurally protected from data loss: the model is
 * only ever asked for what to ADD, and the OLD value is concatenated onto it here in code — the
 * model never sees, and therefore can never overwrite or drop, the existing text. Fields marked
 * "replace" (a current-state snapshot) keep the old model-authored full-replace behavior. */
export async function evolveNpcDossiers(opts: {
  npcs: NpcRecord[];
  recentText: string;
  fields: NpcField[];
  model?: string;
}): Promise<EvolveResult> {
  const { npcs, recentText, fields, model } = opts;
  const trackedNpcs = normalizeExistingNpcs(npcs);

  const dossierLines = trackedNpcs.map((n) => {
    const known = fields
      .map((f) => (n.values[f.key] ? `${f.key}: ${n.values[f.key]}` : null))
      .filter((s): s is string => Boolean(s))
      .join(" | ");
    return `- ${n.name}${known ? ` — ${known}` : " — (no fields filled yet)"}`;
  });

  const userPrompt = [
    "Tracked characters (current dossiers):",
    ...(dossierLines.length ? dossierLines : ["(none)"]),
    "",
    "Recent conversation excerpt:",
    recentText,
  ].join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: buildEvolveSystemPrompt(fields) },
    { role: "user", content: userPrompt },
  ];
  const { content, usage, provider, model: usedModel } = await completeJson({ messages, model: model || undefined, maxTokens: 4000 }, new AbortController().signal);
  const totalUsage: NormalizedUsage = { ...usage };
  const meta: GenerationMeta = { provider, model: usedModel, usage: totalUsage };

  const parsed = parseOuterJsonObject(content);
  if (!parsed || !Array.isArray(parsed.updates)) {
    console.warn(`[NPC Tracker] evolve: no usable JSON in response (likely truncated or malformed). Preview: ${content.slice(-300)}`);
    return { npcs, changed: 0, usage: totalUsage, meta };
  }

  const next: NpcRecord[] = trackedNpcs.map((n) => ({ ...n, values: { ...n.values } }));
  let changed = 0;

  for (const raw of parsed.updates as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object") continue;
    const name = cleanField(raw.name);
    if (!name) continue;
    const target = matchExisting(next, name);
    if (!target) continue; // Never creates new NPCs — evolution only touches already-tracked ones.

    let touchedThisNpc = false;
    for (const f of fields) {
      if (!(f.key in raw)) continue;
      const addition = cleanField(raw[f.key]);
      if (!addition) continue;
      const existing = target.values[f.key] ?? "";
      let nextValue =
        evolveModeOf(f) === "append" ? (f.kind === "tags" ? mergeTagLists(existing, addition) : mergeTextAppend(existing, addition)) : addition;
      if (f.key === "imageTags" && nextValue) nextValue = finalizeImageTags(nextValue, target.name);
      if (nextValue && nextValue !== existing) {
        target.values[f.key] = nextValue;
        touchedThisNpc = true;
      }
    }
    if (touchedThisNpc) changed++;
  }

  return { npcs: next, changed, usage: totalUsage, meta };
}

function buildConsolidateSystemPrompt(fieldLabel: string, kind: NpcFieldKind): string {
  if (kind === "tags") {
    return [
      "You are compacting a Danbooru-style image tag list for a roleplay character dossier because it grew too long from incremental additions over a long story.",
      "Your ONLY job: reduce the list while preserving every DISTINCT physical trait/distinguishing mark it currently encodes. Merge duplicates and near-duplicates (e.g. two tags describing the same hair color/length), drop truly redundant filler — but NEVER drop a tag that is the only mention of a distinguishing feature (scars, unusual marks, heterochromia, etc.).",
      "Target range: 12-20 tags, same convention as elsewhere — comma-separated, multi-word tags use spaces not underscores, physical traits only (no pose/clothes/expression).",
      'Return ONLY valid JSON, no prose: {"value": "tag one, tag two, ..."}',
    ].join("\n");
  }
  return [
    `You are compacting the "${fieldLabel}" field of a roleplay character dossier because it grew too long from incremental additions over a long story.`,
    "Your ONLY job: rewrite it more concisely while preserving EVERY concrete fact it currently states — nothing may be dropped, only reworded/merged for flow. Merge redundant or overlapping sentences, cut filler words, tighten phrasing — but every distinct piece of information must still be recoverable from the result.",
    "Do NOT add anything new. Do NOT remove a fact just because it seems minor — only remove wording, never information. If you genuinely cannot shorten it without losing a fact, return it closer to as-is rather than cutting content.",
    'Return ONLY valid JSON, no prose: {"value": "..."}',
  ].join("\n");
}

/** Compacts one already-large append-only field, preserving every fact — used both by the
 * automatic threshold trigger in evolveNpcDossiers and by a manual "Compactar" action. Fails
 * safe: on any parse/response issue, returns the original value unchanged rather than risk
 * emptying it. */
export async function consolidateNpcField(opts: {
  fieldLabel: string;
  kind: NpcFieldKind;
  currentValue: string;
  model?: string;
}): Promise<{ value: string; usage: NormalizedUsage; meta: GenerationMeta }> {
  const { fieldLabel, kind, currentValue, model } = opts;
  const messages: ChatMessage[] = [
    { role: "system", content: buildConsolidateSystemPrompt(fieldLabel, kind) },
    { role: "user", content: currentValue },
  ];
  const { content, usage, provider, model: usedModel } = await completeJson({ messages, model: model || undefined, maxTokens: 1200 }, new AbortController().signal);
  const meta: GenerationMeta = { provider, model: usedModel, usage };

  const parsed = parseOuterJsonObject(content);
  const value = parsed && typeof parsed.value === "string" ? cleanField(parsed.value) : "";
  if (!value) {
    console.warn(`[NPC Tracker] consolidate: no usable value in response for "${fieldLabel}". Preview: ${content.slice(-200)}`);
    return { value: currentValue, usage, meta };
  }
  return { value, usage, meta };
}

function buildPersonaDossierSystemPrompt(fields: NpcField[]): string {
  const fieldLines = fields.map((f) =>
    f.kind === "tags"
      ? buildTagsFieldInstruction(f.key, f.label)
      : `- "${f.key}" (${f.label}): concrete, specific detail consistent with the description below.`,
  );
  const shape = `{${fields.map((f) => `"${f.key}":"..."`).join(",")}}`;
  return [
    "You are fleshing out a player self-insert character (a 'persona') for a roleplay app, from a short free-text sketch the user wrote about themselves.",
    "Unlike rewriting an established story character, THIS is a creative-completion task: reasonably extrapolate and invent plausible, consistent detail for whatever the sketch doesn't explicitly cover — the user WANTS the gaps filled in, not left blank. Never contradict anything the sketch states.",
    "Return ONLY valid JSON, no prose, in this exact shape:",
    shape,
    "",
    "For each field:",
    ...fieldLines,
  ].join("\n");
}

/** Generates a full dossier (same field schema as NPC Tracker) for a persona from a free-text
 * description — deliberately liberal/creative-extrapolation, the opposite policy from
 * regenerateNpcDossier/evolveNpcDossiers, since there's no real story to stay faithful to yet. */
export async function generatePersonaDossier(opts: {
  description: string;
  fields: NpcField[];
  model?: string;
}): Promise<{ values: Record<string, string>; usage: NormalizedUsage; meta: GenerationMeta }> {
  const { description, fields, model } = opts;
  const messages: ChatMessage[] = [
    { role: "system", content: buildPersonaDossierSystemPrompt(fields) },
    { role: "user", content: `Sketch:\n${description}` },
  ];
  const { content, usage, provider, model: usedModel } = await completeJson({ messages, model: model || undefined, maxTokens: 4000 }, new AbortController().signal);
  const meta: GenerationMeta = { provider, model: usedModel, usage };

  const parsed = parseOuterJsonObject(content);
  if (!parsed) {
    console.warn(`[Persona] generate: no usable JSON in response (likely truncated or malformed). Preview: ${content.slice(-300)}`);
    return { values: {}, usage, meta };
  }

  const values: Record<string, string> = {};
  for (const f of fields) {
    const v = cleanField(parsed[f.key]);
    if (v) values[f.key] = v;
  }
  if (values["imageTags"]) values["imageTags"] = finalizeImageTags(values["imageTags"], "persona");
  return { values, usage, meta };
}
