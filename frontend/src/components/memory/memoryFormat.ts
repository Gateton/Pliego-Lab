import type {
  ActiveMemoryState,
  GuardFinding,
  GuardReport,
  MemoryEpisode,
  MemoryExtractionMode,
  MemoryFact,
  MemoryFactStatus,
  MemoryRevision,
  MemoryThread,
  MemoryThreadKind,
  MemoryThreadStatus,
} from "../../types/activeMemory";
import { formatDate as formatLocalizedDate } from "../../i18n";
import type { TranslationKey } from "../../i18n";

/**
 * Label maps hold catalog keys, never text: the panel resolves them with `t()` where it renders, so
 * a language change reaches every badge, option and timeline entry without a reload.
 */
export const FACT_STATUS_LABELS: Record<MemoryFactStatus, TranslationKey> = {
  candidate: "memory.labels.fact.candidate",
  confirmed: "memory.labels.fact.confirmed",
  disputed: "memory.labels.fact.disputed",
  invalidated: "memory.labels.fact.invalidated",
};

export const THREAD_STATUS_LABELS: Record<MemoryThreadStatus, TranslationKey> = {
  open: "memory.labels.thread.open",
  snoozed: "memory.labels.thread.snoozed",
  resolved: "memory.labels.thread.resolved",
  abandoned: "memory.labels.thread.abandoned",
};

export const THREAD_KIND_LABELS: Record<MemoryThreadKind, TranslationKey> = {
  promise: "memory.labels.threadKind.promise",
  question: "memory.labels.threadKind.question",
  goal: "memory.labels.threadKind.goal",
  threat: "memory.labels.threadKind.threat",
  secret: "memory.labels.threadKind.secret",
  plan: "memory.labels.threadKind.plan",
  conflict: "memory.labels.threadKind.conflict",
  clue: "memory.labels.threadKind.clue",
  interrupted_action: "memory.labels.threadKind.interruptedAction",
};

export const EXTRACTION_MODE_LABELS: Record<MemoryExtractionMode, TranslationKey> = {
  heuristic: "memory.labels.extractionMode.heuristic",
  llm: "memory.labels.extractionMode.llm",
  auto: "memory.labels.extractionMode.auto",
};

export const REVISION_SOURCE_LABELS: Record<MemoryRevision["source"], TranslationKey> = {
  manual: "memory.labels.revisionSource.manual",
  extraction: "memory.labels.revisionSource.extraction",
  rollback: "memory.labels.revisionSource.rollback",
};

export const SEVERITY_LABELS: Record<GuardFinding["severity"], TranslationKey> = {
  low: "memory.labels.severity.low",
  medium: "memory.labels.severity.medium",
  high: "memory.labels.severity.high",
};

export const GUARD_METHOD_LABELS: Record<GuardReport["method"], TranslationKey> = {
  heuristic: "memory.labels.guardMethod.heuristic",
  llm: "memory.labels.guardMethod.llm",
  "heuristic-fallback": "memory.labels.guardMethod.heuristicFallback",
};

export const SKIPPED_LABELS: Record<string, TranslationKey> = {
  disabled: "memory.labels.skipped.disabled",
  "no-new-messages": "memory.labels.skipped.noNewMessages",
};

/** Used when the backend skips a run for a reason this build does not know yet. */
export const SKIPPED_FALLBACK: TranslationKey = "memory.labels.skippedFallback";

export function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatDate(value?: number | string): string | null {
  if (value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatLocalizedDate(date, {
    dateStyle: "medium",
    timeStyle: typeof value === "number" ? "short" : undefined,
  });
}

/** Milliseconds for sorting. Returns null when the value is missing or unparseable. */
export function timestampOf(value?: number | string): number | null {
  if (value === undefined || value === "") return null;
  const time = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function textValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length) return value.map(String).join(", ");
  return null;
}

/** Compact label for a message id so evidence chips stay readable. */
export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function factSentence(fact: MemoryFact): string {
  return [fact.subject, fact.predicate, fact.object].filter((part) => part?.trim()).join(" ");
}

/**
 * Thread review flags arrived with a later contract revision, so they are read optionally: the
 * badge simply does not render while the stored state predates the field.
 */
export function threadNeedsReview(thread: MemoryThread): boolean {
  return (thread as { needsReview?: boolean }).needsReview === true;
}

export function visibleToList(visibleTo: string[] | "all"): string[] {
  return visibleTo === "all" ? [] : visibleTo;
}

/**
 * Every character name that matters for one fact: the known names plus whoever is already listed,
 * so ids that arrived from extraction are never hidden just because the caller did not name them.
 */
export function visibilityVocabulary(knownNames: string[], visibleTo: string[] | "all"): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const name of [...knownNames, ...visibleToList(visibleTo)]) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

/**
 * Grants or removes knowledge of one fact for one character.
 *
 * Removing someone from an "everyone knows" fact turns it into the explicit list of the remaining
 * witnesses, and emptying a list falls back to "all" because the backend normalizes an empty list
 * that way. Callers should disable the last removal instead of relying on that fallback.
 */
export function toggleVisibleTo(
  visibleTo: string[] | "all",
  name: string,
  vocabulary: string[],
): string[] | "all" {
  if (visibleTo === "all") {
    const rest = vocabulary.filter((entry) => entry !== name);
    return rest.length ? rest : "all";
  }
  const next = visibleTo.includes(name)
    ? visibleTo.filter((entry) => entry !== name)
    : [...visibleTo, name];
  return next.length ? next : "all";
}

export function episodeTimestamp(episode: MemoryEpisode): number | null {
  return timestampOf(episode.occurredAt) ?? timestampOf(episode.createdAt);
}

export function memoryIsEmpty(memory: ActiveMemoryState): boolean {
  const sceneHasValues = Object.values(memory.scene ?? {}).some((value) => textValue(value));
  return !sceneHasValues && memory.facts.length === 0 && memory.threads.length === 0
    && (memory.episodes?.length ?? 0) === 0 && !memory.lastBrief;
}

export function itemLabel(memory: ActiveMemoryState, type: string, id: string): string | undefined {
  if (type === "fact") {
    const fact = memory.facts.find((entry) => entry.id === id);
    return fact ? factSentence(fact) : undefined;
  }
  if (type === "thread") return memory.threads.find((entry) => entry.id === id)?.title;
  if (type === "episode") return memory.episodes.find((entry) => entry.id === id)?.summary;
  return undefined;
}

/** First evidence a selection points at, used to offer "ver mensaje" from the explained brief. */
export function itemMessageId(memory: ActiveMemoryState, type: string, id: string): string | undefined {
  if (type === "fact") return memory.facts.find((entry) => entry.id === id)?.evidenceMessageIds[0];
  if (type === "thread") return memory.threads.find((entry) => entry.id === id)?.evidenceMessageIds[0];
  if (type === "episode") return memory.episodes.find((entry) => entry.id === id)?.sourceMessageIds[0];
  return undefined;
}
