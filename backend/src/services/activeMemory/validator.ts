import type {
  ExtractedEpisode,
  ExtractedFact,
  ExtractedScenePatch,
  ExtractedThread,
  MemoryExtractionDraft,
  MemoryFactStatus,
  MemoryThreadKind,
  MemoryThreadStatus,
} from "./types.js";

const FACT_STATUSES = new Set<MemoryFactStatus>(["candidate", "confirmed", "disputed", "invalidated"]);
const THREAD_STATUSES = new Set<MemoryThreadStatus>(["open", "snoozed", "resolved", "abandoned"]);
const THREAD_KINDS = new Set<MemoryThreadKind>([
  "promise",
  "question",
  "goal",
  "threat",
  "secret",
  "plan",
  "conflict",
  "clue",
  "interrupted_action",
]);

export function clampNumber(value: unknown, fallback: number, minimum = 0, maximum = 1): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

export function cleanText(value: unknown, maxLength = 1_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function uniqueStrings(value: unknown, maxItems = 50): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const cleaned = cleanText(item, 200);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }
  return result;
}

/**
 * Clothing and physical appearance belong to Image Director, which keeps a dedicated visual ledger
 * and follows the prose as the source of truth. When Memoria Viva also records "Daren wears a blue
 * coat" as canon, the two systems disagree the moment one of them changes, so those facts are
 * deferred. The list stays deliberately concrete (garments and appearance) and never touches
 * injuries, senses or species, which are canon and only Memoria Viva tracks.
 */
const VISUAL_APPEARANCE_TERMS = [
  "ropa",
  "vestido",
  "vestida",
  "vestía",
  "vestia",
  "vestuario",
  "atuendo",
  "abrigo",
  "armadura",
  "uniforme",
  "outfit",
  "clothing",
  "clothes",
  "capa",
  "túnica",
  "tunica",
  "botas",
  "guantes",
  "sombrero",
  "cinturón",
  "cinturon",
  "camisa",
  "camiseta",
  "falda",
  "pantalón",
  "pantalones",
  "chaqueta",
  "jersey",
  "sudadera",
  "máscara",
  "mascara",
  "traje",
  "desnudo",
  "desnuda",
  "cabello",
  "pelo",
  "peinado",
  "apariencia",
  // English equivalents. Without these an English chat records "Daren wears a blue coat" as canon
  // while the Image Director tracks the same coat in its own ledger, and the two disagree.
  "coat",
  "jacket",
  "cloak",
  "cape",
  "robe",
  "dress",
  "gown",
  "shirt",
  "t-shirt",
  "tshirt",
  "blouse",
  "sweater",
  "hoodie",
  "jumper",
  "skirt",
  "pants",
  "trousers",
  "jeans",
  "shorts",
  "boots",
  "shoes",
  "gloves",
  "hat",
  "helmet",
  "mask",
  "belt",
  "armor",
  "armour",
  "uniform",
  "wears",
  "wearing",
  "wore",
  "dressed",
  "undressed",
  "naked",
  "nude",
  "hair",
  "hairstyle",
  "braid",
  "ponytail",
  "appearance",
];

/** Word-ish check that also works with accented letters, where `\b` does not. */
function hasTerm(text: string, term: string): boolean {
  const haystack = text.toLocaleLowerCase();
  const isWordChar = (character: string) => /[\p{L}\p{N}_]/u.test(character);
  let index = haystack.indexOf(term);
  while (index >= 0) {
    const before = index > 0 ? haystack[index - 1] : "";
    const after = index + term.length < haystack.length ? haystack[index + term.length] : "";
    if (!isWordChar(before) && !isWordChar(after)) return true;
    index = haystack.indexOf(term, index + 1);
  }
  return false;
}

/** True when any of the supplied fact parts describes clothing, outfit or physical appearance. */
export function describesVisualAppearance(...parts: Array<string | undefined>): boolean {
  return parts.some((part) => {
    if (!part) return false;
    return VISUAL_APPEARANCE_TERMS.some((term) => hasTerm(part, term));
  });
}

function validEvidence(value: unknown, allowedMessageIds: Set<string>): string[] {
  return uniqueStrings(value).filter((id) => allowedMessageIds.has(id));
}

function validateScene(value: unknown, allowedMessageIds: Set<string>): ExtractedScenePatch | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const scene = value as Record<string, unknown>;
  const result: ExtractedScenePatch = {};
  const textFields = [
    "location",
    "narrativeTime",
    "immediateGoal",
    "pendingAction",
    "tone",
    "tension",
    "lastSignificantChange",
  ] as const;
  for (const field of textFields) {
    const cleaned = cleanText(scene[field]);
    if (cleaned) result[field] = cleaned;
  }
  const presentCharacterIds = uniqueStrings(scene.presentCharacterIds);
  const relevantObjects = uniqueStrings(scene.relevantObjects);
  const evidenceMessageIds = validEvidence(scene.evidenceMessageIds, allowedMessageIds);
  if (presentCharacterIds.length) result.presentCharacterIds = presentCharacterIds;
  if (relevantObjects.length) result.relevantObjects = relevantObjects;
  if (evidenceMessageIds.length) result.evidenceMessageIds = evidenceMessageIds;
  return Object.keys(result).length ? result : undefined;
}

function validateFact(value: unknown, allowedMessageIds: Set<string>): ExtractedFact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fact = value as Record<string, unknown>;
  const subject = cleanText(fact.subject, 200);
  const predicate = cleanText(fact.predicate, 100);
  const object = cleanText(fact.object, 800);
  const evidenceMessageIds = validEvidence(fact.evidenceMessageIds, allowedMessageIds);
  if (!subject || !predicate || !object || evidenceMessageIds.length === 0) return null;
  const status = FACT_STATUSES.has(fact.status as MemoryFactStatus) ? (fact.status as MemoryFactStatus) : "candidate";
  const visibleTo = fact.visibleTo === "all" ? "all" : uniqueStrings(fact.visibleTo);
  return {
    subject,
    predicate,
    object,
    evidenceMessageIds,
    confidence: clampNumber(fact.confidence, 0.65),
    importance: clampNumber(fact.importance, 0.5),
    visibleTo: visibleTo === "all" || visibleTo.length ? visibleTo : "all",
    status,
    pinned: fact.pinned === true,
  };
}

function validateThread(value: unknown, allowedMessageIds: Set<string>): ExtractedThread | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const thread = value as Record<string, unknown>;
  const title = cleanText(thread.title, 800);
  const evidenceMessageIds = validEvidence(thread.evidenceMessageIds, allowedMessageIds);
  if (!title || evidenceMessageIds.length === 0) return null;
  const kind = THREAD_KINDS.has(thread.kind as MemoryThreadKind) ? (thread.kind as MemoryThreadKind) : "goal";
  const status = THREAD_STATUSES.has(thread.status as MemoryThreadStatus)
    ? (thread.status as MemoryThreadStatus)
    : "open";
  return {
    title,
    kind,
    status,
    participantIds: uniqueStrings(thread.participantIds),
    evidenceMessageIds,
    priority: clampNumber(thread.priority, 0.5, 0, 5),
    resolutionCondition: cleanText(thread.resolutionCondition, 500),
    pinned: thread.pinned === true,
  };
}

function validateEpisode(value: unknown, allowedMessageIds: Set<string>): ExtractedEpisode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const episode = value as Record<string, unknown>;
  const summary = cleanText(episode.summary, 1_000);
  const sourceMessageIds = validEvidence(episode.sourceMessageIds, allowedMessageIds);
  if (!summary || sourceMessageIds.length === 0) return null;
  return {
    summary,
    sourceMessageIds,
    participantIds: uniqueStrings(episode.participantIds),
    location: cleanText(episode.location, 300),
    outcome: cleanText(episode.outcome, 500),
    emotionalWeight: clampNumber(episode.emotionalWeight, 0.5),
    occurredAt: cleanText(episode.occurredAt, 200),
    pinned: episode.pinned === true,
  };
}

export function validateExtractionDraft(
  value: unknown,
  allowedMessageIds: Iterable<string>,
): { draft: MemoryExtractionDraft; warnings: string[] } {
  const allowed = new Set(allowedMessageIds);
  const root = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const rawFacts = Array.isArray(root.facts) ? root.facts.slice(0, 100) : [];
  const rawThreads = Array.isArray(root.threads) ? root.threads.slice(0, 100) : [];
  const rawEpisodes = Array.isArray(root.episodes) ? root.episodes.slice(0, 50) : [];
  const facts = rawFacts.map((item) => validateFact(item, allowed)).filter((item): item is ExtractedFact => item !== null);
  const threads = rawThreads
    .map((item) => validateThread(item, allowed))
    .filter((item): item is ExtractedThread => item !== null);
  const episodes = rawEpisodes
    .map((item) => validateEpisode(item, allowed))
    .filter((item): item is ExtractedEpisode => item !== null);
  const rejected = rawFacts.length - facts.length + rawThreads.length - threads.length + rawEpisodes.length - episodes.length;
  return {
    draft: { scene: validateScene(root.scene, allowed), facts, threads, episodes },
    warnings: rejected > 0 ? [`Rejected ${rejected} extracted item(s) without valid content or evidence.`] : [],
  };
}
