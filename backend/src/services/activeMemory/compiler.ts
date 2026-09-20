import { retrieveActiveMemory, type RetrieveMemoryOptions, type RetrievedMemoryItem } from "./retriever.js";
import type { ActiveMemoryState, MemoryBriefTrace, MemoryEpisode, MemoryFact, MemoryThread } from "./types.js";

export interface CompileMemoryOptions extends RetrieveMemoryOptions {
  now?: () => number;
  maxCharacters?: number;
  /** Context window of the presets in play. Enables the relative budget when provided. */
  maxContextTokens?: number;
}

export interface CompiledMemoryBrief {
  brief: string;
  trace: MemoryBriefTrace;
}

/**
 * The brief budget is expressed in tokens (a share of the context window) but enforced in
 * characters, so the compiler needs a ratio: 4 characters per token is the standard rule of thumb
 * for prose in English and Spanish. It is deliberately slightly generous — undercounting tokens
 * would truncate the brief in the middle of a fact.
 */
export const CHARACTERS_PER_TOKEN = 4;
export const MIN_BRIEF_CHARACTERS = 500;
export const MAX_BRIEF_CHARACTERS = 50_000;

/** Envelope around the compiled brief. Model-facing, so the wording stays in English. */
const MEMORY_OPEN = "[ACTIVE MEMORY — LIVE CANON]";
const MEMORY_CLOSE = "[/ACTIVE MEMORY]";

/**
 * Resolves the character budget for this compile pass. When `relateBudgetToContext` is on and the
 * caller knows the context window, memory is capped at `briefBudgetPercent` of that window
 * (converted with the 4:1 ratio) instead of the fixed `maxBriefCharacters`. Both paths share the
 * same clamp, so a bad ratio or an absurd percentage can never blow up the prompt.
 */
export function resolveBriefCharacterBudget(state: ActiveMemoryState, options: CompileMemoryOptions = {}): number {
  const maxContextTokens = options.maxContextTokens;
  const relative =
    state.settings.relateBudgetToContext &&
    typeof maxContextTokens === "number" &&
    Number.isFinite(maxContextTokens) &&
    maxContextTokens > 0;
  const requested = relative
    ? Math.round((maxContextTokens * state.settings.briefBudgetPercent) / 100) * CHARACTERS_PER_TOKEN
    : options.maxCharacters ?? state.settings.maxBriefCharacters;
  return Math.max(MIN_BRIEF_CHARACTERS, Math.min(requested, MAX_BRIEF_CHARACTERS));
}

function selectionKey(trace: MemoryBriefTrace): string {
  return trace.selected.map((item) => `${item.type}:${item.id}`).join(",");
}

/**
 * Prompt caching only survives if the injected block stops moving. The trace is metadata, but it is
 * stored inside the ledger, and rewriting it every turn is what made the ledger churn (and the diff
 * unreadable) even when the model received the exact same memory. Only the material parts — the
 * brief text and the selected ids — decide whether a new trace replaces the stored one.
 */
export function briefTraceChanged(previous: MemoryBriefTrace | undefined, next: MemoryBriefTrace): boolean {
  if (!previous) return true;
  if (previous.brief !== next.brief) return true;
  return selectionKey(previous) !== selectionKey(next);
}

/** Stores `trace` only when it differs materially from the stored one. Returns whether it did. */
export function commitBriefTrace(state: ActiveMemoryState, trace: MemoryBriefTrace): boolean {
  if (!briefTraceChanged(state.lastBrief, trace)) return false;
  state.lastBrief = trace;
  return true;
}

function itemLine(entry: RetrievedMemoryItem): string {
  if (entry.type === "fact") {
    const fact = entry.item as MemoryFact;
    return `- ${fact.subject} ${fact.predicate} ${fact.object}. [${fact.status}]`;
  }
  if (entry.type === "thread") return `- ${(entry.item as MemoryThread).title}`;
  return `- ${(entry.item as MemoryEpisode).summary}`;
}

function sceneLines(state: ActiveMemoryState): string[] {
  const scene = state.scene;
  const lines: string[] = [];
  const heading = [scene.location, scene.narrativeTime].filter(Boolean).join(", ");
  if (heading) lines.push(`SCENE: ${heading}.`);
  if (scene.presentCharacterIds.length) lines.push(`PRESENT: ${[...scene.presentCharacterIds].sort().join(", ")}.`);
  if (scene.immediateGoal) lines.push(`IMMEDIATE GOAL: ${scene.immediateGoal}`);
  if (scene.pendingAction) lines.push(`PENDING ACTION: ${scene.pendingAction}`);
  if (scene.lastSignificantChange) lines.push(`LAST SIGNIFICANT CHANGE: ${scene.lastSignificantChange}`);
  return lines;
}

export function compileActiveMemoryBrief(state: ActiveMemoryState, options: CompileMemoryOptions = {}): CompiledMemoryBrief {
  if (!state.settings.enabled) {
    const brief = "";
    return {
      brief,
      trace: {
        query: options.query ?? "",
        responderId: options.responderId,
        generatedAt: (options.now ?? Date.now)(),
        selected: [],
        omittedCount: 0,
        brief,
      },
    };
  }

  const retrieval = retrieveActiveMemory(state, options);
  const maxCharacters = resolveBriefCharacterBudget(state, options);
  const emptyTrace: MemoryBriefTrace = {
    query: options.query ?? "",
    responderId: options.responderId,
    generatedAt: (options.now ?? Date.now)(),
    selected: [],
    omittedCount: retrieval.omittedCount,
    brief: "",
  };
  // A ledger with nothing meaningful must inject nothing: an empty "[ACTIVE MEMORY]" shell would
  // still cost tokens and tell the model that its memory is blank.
  if (retrieval.items.length === 0 && sceneLines(state).length === 0) return { brief: "", trace: emptyTrace };

  const lines = [MEMORY_OPEN, ...sceneLines(state)];
  const included: RetrievedMemoryItem[] = [];
  const groups = [
    { type: "fact" as const, heading: "ACTIVE FACTS:" },
    { type: "thread" as const, heading: "OPEN THREADS:" },
    { type: "episode" as const, heading: "RELEVANT MEMORIES:" },
  ];
  for (const group of groups) {
    const entries = retrieval.items.filter((entry) => entry.type === group.type);
    if (!entries.length) continue;
    const acceptedLines: string[] = [];
    for (const entry of entries) {
      const line = itemLine(entry);
      const candidate = [...lines, group.heading, ...acceptedLines, line, MEMORY_CLOSE].join("\n");
      if (candidate.length > maxCharacters) continue;
      acceptedLines.push(line);
      included.push(entry);
    }
    if (acceptedLines.length) lines.push("", group.heading, ...acceptedLines);
  }
  lines.push("", "CONTINUITY RULE:", "Do not contradict this data. Do not reveal information to characters who do not know it.", MEMORY_CLOSE);
  let brief = lines.join("\n");
  if (brief.length > maxCharacters) brief = `${brief.slice(0, Math.max(0, maxCharacters - MEMORY_CLOSE.length - 1)).trimEnd()}\n${MEMORY_CLOSE}`;
  const trace: MemoryBriefTrace = {
    query: options.query ?? "",
    responderId: options.responderId,
    generatedAt: (options.now ?? Date.now)(),
    selected: included.map(({ type, id, score, reasons }) => ({ type, id, score, reasons })),
    omittedCount: retrieval.omittedCount + (retrieval.items.length - included.length),
    brief,
  };
  return { brief, trace };
}
