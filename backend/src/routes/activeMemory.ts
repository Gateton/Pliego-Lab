import { Router } from "express";
import * as chatStore from "../services/chatStore.js";
import * as characterStore from "../services/characterStore.js";
import { applyExtractionDraft, extractActiveMemory, type MemoryEntityRef } from "../services/activeMemory/extractor.js";
import { commitBriefTrace, compileActiveMemoryBrief } from "../services/activeMemory/compiler.js";
import {
  getActiveMemory,
  updateActiveMemory,
  rollbackActiveMemory,
  deleteActiveMemory,
} from "../services/activeMemory/store.js";
import {
  createSharedLedgerStore,
  mergeSharedLedger,
  publishToSharedLedger,
  scopeIsShared,
} from "../services/activeMemory/scope.js";
import { cleanText, uniqueStrings } from "../services/activeMemory/validator.js";
import type {
  ActiveMemorySettings,
  ActiveMemoryState,
  MemoryFactStatus,
  MemoryExtractionInput,
  MemoryInvalidationReport,
  MemoryItemType,
  MemoryScopeMode,
  MemoryThreadStatus,
} from "../services/activeMemory/types.js";
import { apiErrorBody } from "../services/apiError.js";

export const activeMemoryRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same guard the chat router applies: an id that cannot be a chat is a client error, not a missing
// resource, and it keeps the memory path from being probed with arbitrary strings.
activeMemoryRouter.param("id", (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid chat id" });
    return;
  }
  next();
});

const FACT_STATUSES = new Set<MemoryFactStatus>(["candidate", "confirmed", "disputed", "invalidated"]);
const THREAD_STATUSES = new Set<MemoryThreadStatus>(["open", "snoozed", "resolved", "abandoned"]);
const MEMORY_ITEM_TYPES = new Set<MemoryItemType>(["fact", "thread", "episode"]);
const SCOPE_MODES = new Set<MemoryScopeMode>(["chat", "shared"]);

/**
 * How many trailing messages a single extraction pass may look at.
 */
const EXTRACTION_WINDOW = 12;
/**
 * The first pass over a chat that already has history has nothing to resume from, so it is allowed
 * to read much further back. Without this, adopting Memoria Viva in an ongoing chat would only ever
 * remember the last handful of messages — exactly the ones still inside the context window.
 */
const INITIAL_BACKFILL_WINDOW = 60;
/** Upper bound for one invalidation request; a whole-chat wipe belongs to DELETE /memory. */
const MAX_INVALIDATED_MESSAGES = 500;

const sharedLedger = createSharedLedgerStore();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function shortId(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 40) : "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Reads a patched number only when it is sane; anything else is ignored instead of failing the request. */
function patchedNumber(value: unknown, min: number, max: number, integer = false): number | undefined {
  if (!isFiniteNumber(value)) return undefined;
  const bounded = Math.min(max, Math.max(min, value));
  return integer ? Math.round(bounded) : bounded;
}

function uniqueIds(value: unknown, maxItems = MAX_INVALIDATED_MESSAGES): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }
  return result;
}

/**
 * Collects the messages a new extraction pass should read. When the state already processed some
 * messages we only look at what came after — re-reading the whole chat on every turn would burn
 * tokens and re-add facts that are already known.
 */
function pendingMessages(messages: MemoryExtractionInput[], lastProcessedMessageId?: string): MemoryExtractionInput[] {
  let start = 0;
  if (lastProcessedMessageId) {
    const index = messages.findIndex((message) => message.id === lastProcessedMessageId);
    if (index >= 0) start = index + 1;
  }
  const window = start === 0 ? INITIAL_BACKFILL_WINDOW : EXTRACTION_WINDOW;
  return messages.slice(start).slice(-window);
}

function toExtractionInputs(chat: { messages: Array<{ id: string; role: string; swipes: string[]; activeSwipeIndex: number; createdAt: number }> }): MemoryExtractionInput[] {
  return chat.messages.map((message) => ({
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.swipes[message.activeSwipeIndex] ?? "",
    createdAt: message.createdAt,
  }));
}

/**
 * Entities the chat already knows, as id + name: the NPC roster plus the character card. Resolving
 * facts against these ids is what lets the retriever later match "this character is on stage"
 * without re-parsing prose, and it keeps Memoria Viva and NPC Tracker pointing at the same entity.
 */
async function entitiesFor(chat: { characterId: string | null; npcs?: Array<{ id?: string; name: string }> }): Promise<MemoryEntityRef[]> {
  const entities: MemoryEntityRef[] = [];
  const seen = new Set<string>();
  const push = (id: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const key = `${id}|${cleanName.toLocaleLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({ id: id || cleanName, name: cleanName });
  };
  for (const npc of chat.npcs ?? []) {
    if (!npc?.name) continue;
    push(typeof npc.id === "string" ? npc.id : "", npc.name);
  }
  if (chat.characterId) {
    const character = await characterStore.readCharacter(chat.characterId).catch(() => null);
    push(chat.characterId, character?.name ?? "");
  }
  return entities;
}

/** Names the extractor may treat as known even when they only open a sentence. */
function knownNamesFor(entities: MemoryEntityRef[]): string[] {
  return entities.map((entity) => entity.name);
}

/**
 * The brief and the panel must see the canon the chat actually plays against. With a shared scope
 * the chat's own ledger stays untouched on disk — disabling the feature stays a no-op instead of a
 * data migration — and the shared entries are folded in at read time, the chat winning conflicts.
 */
async function readEffectiveMemory(chatId: string): Promise<ActiveMemoryState> {
  const local = await getActiveMemory(chatId);
  if (!scopeIsShared(local.settings.scope)) return local;
  const shared = await sharedLedger.read(local.settings.scope.key).catch(() => null);
  const merged = mergeSharedLedger(local, shared);
  return { ...local, facts: merged.facts, threads: merged.threads, episodes: merged.episodes };
}

/** Republishes the chat's canon into its shared ledger, keeping newer entries already there. */
async function publishSharedMemory(state: ActiveMemoryState): Promise<void> {
  if (!scopeIsShared(state.settings.scope)) return;
  const key = state.settings.scope.key;
  const existing = await sharedLedger.read(key).catch(() => null);
  await sharedLedger.write(key, publishToSharedLedger(state, existing));
}

activeMemoryRouter.get("/:id/memory", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  res.json({ memory: await readEffectiveMemory(req.params.id) });
});

/**
 * Applies a settings patch. Only known keys with a valid value are copied over; unknown keys and
 * wrong types are ignored, so an older panel (or a newer one) can never break the endpoint.
 */
export function applySettingsPatch(settings: ActiveMemorySettings, patch: Record<string, unknown>): ActiveMemorySettings {
  const next: ActiveMemorySettings = {
    ...settings,
    semantic: { ...settings.semantic },
    scope: { ...settings.scope },
  };
  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (typeof patch.model === "string") next.model = patch.model.slice(0, 200);
  if (patch.extractionMode === "heuristic" || patch.extractionMode === "llm" || patch.extractionMode === "auto") {
    next.extractionMode = patch.extractionMode;
  }
  const maxFacts = patchedNumber(patch.maxFacts, 1, 500, true);
  if (maxFacts !== undefined) next.maxFacts = maxFacts;
  const maxThreads = patchedNumber(patch.maxThreads, 1, 500, true);
  if (maxThreads !== undefined) next.maxThreads = maxThreads;
  const maxEpisodes = patchedNumber(patch.maxEpisodes, 1, 500, true);
  if (maxEpisodes !== undefined) next.maxEpisodes = maxEpisodes;
  const maxBriefItems = patchedNumber(patch.maxBriefItems, 1, 200, true);
  if (maxBriefItems !== undefined) next.maxBriefItems = maxBriefItems;
  const maxBriefCharacters = patchedNumber(patch.maxBriefCharacters, 500, 50_000, true);
  if (maxBriefCharacters !== undefined) next.maxBriefCharacters = maxBriefCharacters;
  const briefBudgetPercent = patchedNumber(patch.briefBudgetPercent, 1, 50);
  if (briefBudgetPercent !== undefined) next.briefBudgetPercent = briefBudgetPercent;
  if (typeof patch.relateBudgetToContext === "boolean") next.relateBudgetToContext = patch.relateBudgetToContext;
  if (typeof patch.deferVisualFactsToDirector === "boolean") {
    next.deferVisualFactsToDirector = patch.deferVisualFactsToDirector;
  }
  if (isRecord(patch.semantic)) {
    if (typeof patch.semantic.enabled === "boolean") next.semantic.enabled = patch.semantic.enabled;
    if (typeof patch.semantic.model === "string") next.semantic.model = patch.semantic.model.slice(0, 200);
    const minScore = patchedNumber(patch.semantic.minScore, 0, 1);
    if (minScore !== undefined) next.semantic.minScore = minScore;
  }
  if (isRecord(patch.scope)) {
    if (typeof patch.scope.mode === "string" && SCOPE_MODES.has(patch.scope.mode as MemoryScopeMode)) {
      next.scope.mode = patch.scope.mode as MemoryScopeMode;
    }
    if (typeof patch.scope.key === "string") {
      next.scope.key = patch.scope.key.replace(/[^0-9a-z._-]/gi, "_").slice(0, 96);
    }
  }
  return next;
}

/**
 * Manual edit of one fact or thread. Only the fields the panel can change are accepted; an unknown
 * field is dropped rather than stored as garbage.
 */
export function patchMemoryItem(
  state: ActiveMemoryState,
  target: "fact" | "thread",
  itemId: string,
  patch: Record<string, unknown>,
): boolean {
  if (target === "fact") {
    const fact = state.facts.find((item) => item.id === itemId);
    if (!fact) return false;
    if (typeof patch.pinned === "boolean") fact.pinned = patch.pinned;
    if (FACT_STATUSES.has(patch.status as MemoryFactStatus)) fact.status = patch.status as MemoryFactStatus;
    // Re-confirming a fact that had been superseded clears the supersession so it is injected again.
    if (patch.status === "confirmed") delete fact.validUntilMessageId;
    if (patch.visibleTo === "all") {
      fact.visibleTo = "all";
    } else if (Array.isArray(patch.visibleTo)) {
      const visibleTo = uniqueStrings(patch.visibleTo);
      // An empty list would hide the fact from literally everyone; that is a mistake, not an edit.
      if (visibleTo.length) fact.visibleTo = visibleTo;
    }
    if (typeof patch.needsReview === "boolean") {
      if (patch.needsReview) fact.needsReview = true;
      else delete fact.needsReview;
    }
    fact.updatedAt = Date.now();
    return true;
  }
  const thread = state.threads.find((item) => item.id === itemId);
  if (!thread) return false;
  if (THREAD_STATUSES.has(patch.status as MemoryThreadStatus)) thread.status = patch.status as MemoryThreadStatus;
  if (typeof patch.pinned === "boolean") thread.pinned = patch.pinned;
  if (typeof patch.title === "string") {
    const title = cleanText(patch.title, 800);
    if (title) thread.title = title;
  }
  if (typeof patch.needsReview === "boolean") {
    if (patch.needsReview) thread.needsReview = true;
    else delete thread.needsReview;
  }
  return true;
}

/** Manual edits from the panel: fact fields, thread fields, or the engine settings. */
activeMemoryRouter.patch("/:id/memory", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const body = req.body as { target?: unknown; id?: unknown; patch?: unknown };
  const target = typeof body.target === "string" ? body.target : "";
  const patch = isRecord(body.patch) ? body.patch : null;
  const itemId = typeof body.id === "string" ? body.id : "";

  if (!patch || !["fact", "thread", "settings"].includes(target)) {
    res.status(400).json({ error: "target must be fact, thread or settings" });
    return;
  }
  if (target !== "settings" && !itemId) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const updated = await updateActiveMemory(
    req.params.id,
    (draft) => {
      if (target === "settings") {
        draft.settings = applySettingsPatch(draft.settings, patch);
        return true;
      }
      return patchMemoryItem(draft, target as "fact" | "thread", itemId, patch);
    },
    { revision: { source: "manual", summary: `${target} ${itemId} edited from the panel` } },
  );

  // Switching to a shared scope publishes the canon the chat already has, so the other chats in the
  // scope start from it. Switching back to "chat" deliberately leaves the shared file alone.
  if (target === "settings" && patch.scope && scopeIsShared(updated.state.settings.scope)) {
    await publishSharedMemory(updated.state);
  }

  const memory = scopeIsShared(updated.state.settings.scope) ? await readEffectiveMemory(req.params.id) : updated.state;
  res.json({ memory });
});

/** Preview of exactly what the model would receive, without touching stored state. */
activeMemoryRouter.post("/:id/memory/retrieve", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  const body = req.body as {
    query?: unknown;
    responderId?: unknown;
    persist?: unknown;
    maxContextTokens?: unknown;
    entityIds?: unknown;
  };
  const state = await readEffectiveMemory(req.params.id);
  const compiled = compileActiveMemoryBrief(state, {
    query: typeof body.query === "string" ? body.query : "",
    responderId: typeof body.responderId === "string" && body.responderId ? body.responderId : undefined,
    maxContextTokens: patchedNumber(body.maxContextTokens, 1, 10_000_000, true),
    entityIds: uniqueIds(body.entityIds, 50),
  });

  // `persist` records the trace so the panel can show what the last real turn used. It is only
  // rewritten when the brief or the selected ids actually changed, so an unchanged turn leaves the
  // ledger (and the injected block) byte-identical and prompt caching intact.
  if (body.persist === true && compiled.brief) {
    const stored = await updateActiveMemory(req.params.id, (draft) => {
      commitBriefTrace(draft, compiled.trace);
    });
    res.json({ brief: compiled.brief, trace: compiled.trace, memory: stored.state });
    return;
  }
  res.json({ brief: compiled.brief, trace: compiled.trace });
});

/**
 * Runs one extraction pass over the messages that arrived since the last pass and merges the
 * result into the ledger. Failures never bubble up as a broken turn: the caller gets a report
 * with warnings instead.
 */
activeMemoryRouter.post("/:id/memory/extract", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const body = req.body as { mode?: unknown; model?: unknown; all?: unknown };
  const state = await readEffectiveMemory(req.params.id);
  // A disabled memory keeps storing nothing: the switch is the user's promise that this chat
  // behaves exactly like it did before the feature existed.
  if (!state.settings.enabled) {
    res.json({ memory: state, report: null, skipped: "disabled" });
    return;
  }
  const messages = toExtractionInputs(chat);
  const window = body.all === true ? messages.slice(-EXTRACTION_WINDOW * 3) : pendingMessages(messages, state.lastProcessedMessageId);

  if (window.length === 0) {
    res.json({ memory: state, report: null, skipped: "no-new-messages" });
    return;
  }

  const entities = await entitiesFor(chat);
  const extraction = await extractActiveMemory({
    messages: window,
    state,
    mode: body.mode === "heuristic" || body.mode === "llm" || body.mode === "auto" ? body.mode : undefined,
    model: typeof body.model === "string" && body.model ? body.model : undefined,
    knownNames: knownNamesFor(entities),
    entities,
  });

  const updated = await updateActiveMemory(
    req.params.id,
    (draft) => applyExtractionDraft(draft, extraction),
    {
      revision: {
        source: "extraction",
        summary: `Extracted from ${window.length} message(s) (${extraction.report.method})`,
      },
    },
  );

  if (scopeIsShared(updated.state.settings.scope)) await publishSharedMemory(updated.state);
  const memory = scopeIsShared(updated.state.settings.scope) ? await readEffectiveMemory(req.params.id) : updated.state;

  res.json({
    memory,
    // `updated.result` is the report of what actually landed in the ledger; the extraction's own
    // report still has counters at zero because merging happens inside the transaction.
    report: { ...updated.result, warnings: updated.result.warnings.map((warning) => warning.slice(0, 300)) },
  });
});

/**
 * Invalidates the memory that cites the given messages (edited, deleted or re-swiped evidence).
 * Facts and threads whose evidence is gone are flagged for review instead of being deleted — a fact
 * can cite several messages and only part of it may be wrong — while an episode whose entire source
 * range is invalidated loses its reason to exist. The extraction cursor is rewound to just before
 * the oldest affected message so the next pass re-reads that zone and can rebuild what was lost.
 */
export function invalidateMemoryEvidence(
  state: ActiveMemoryState,
  messageIds: string[],
  options: { reason?: string; chatMessageIds?: string[] } = {},
): MemoryInvalidationReport {
  const invalidated = new Set(messageIds);
  const report: MemoryInvalidationReport = {
    messageIds: [...invalidated],
    reason: options.reason ?? "",
    factsMarkedForReview: 0,
    threadsMarkedForReview: 0,
    episodesRemoved: 0,
  };

  for (const fact of state.facts) {
    if (!fact.evidenceMessageIds?.some((id) => invalidated.has(id))) continue;
    if (fact.needsReview !== true) report.factsMarkedForReview += 1;
    fact.needsReview = true;
  }
  for (const thread of state.threads) {
    if (!thread.evidenceMessageIds?.some((id) => invalidated.has(id))) continue;
    if (thread.needsReview !== true) report.threadsMarkedForReview += 1;
    thread.needsReview = true;
  }
  state.episodes = state.episodes.filter((episode) => {
    const sources = episode.sourceMessageIds ?? [];
    const fullyInvalidated = sources.length > 0 && sources.every((id) => invalidated.has(id));
    if (fullyInvalidated) report.episodesRemoved += 1;
    return !fullyInvalidated;
  });

  const chatOrder = options.chatMessageIds ?? [];
  const firstAffected = chatOrder.findIndex((id) => invalidated.has(id));
  if (firstAffected > 0) {
    report.rewoundToMessageId = chatOrder[firstAffected - 1];
    state.lastProcessedMessageId = report.rewoundToMessageId;
  } else if (firstAffected === 0) {
    // The very first message changed: there is nothing before it to resume from, so the next pass
    // starts from the beginning again.
    delete state.lastProcessedMessageId;
  }
  return report;
}

activeMemoryRouter.post("/:id/memory/invalidate", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  const body = req.body as { messageIds?: unknown; reason?: unknown };
  const messageIds = uniqueIds(body.messageIds);
  if (!messageIds.length) {
    res.status(400).json({ error: "messageIds must be a non-empty array of strings" });
    return;
  }
  const reason = cleanText(body.reason, 300) ?? "evidence invalidated";

  const updated = await updateActiveMemory(
    req.params.id,
    (draft) => invalidateMemoryEvidence(draft, messageIds, { reason, chatMessageIds: chat.messages.map((message) => message.id) }),
    {
      revision: {
        source: "extraction",
        summary: `Invalidated ${messageIds.length} message(s) of evidence: ${reason}`,
      },
    },
  );

  res.json({ memory: updated.state, report: updated.result });
});

export type MergeMemoryResult = { ok: true } | { ok: false; status: 400 | 404; error: string };

/** Merges `mergeId` into `keepId`: evidence is unified, nothing material is lost, the duplicate goes. */
export function mergeMemoryItems(
  state: ActiveMemoryState,
  target: MemoryItemType,
  keepId: string,
  mergeId: string,
): MergeMemoryResult {
  if (!MEMORY_ITEM_TYPES.has(target)) return { ok: false, status: 400, error: "target must be fact, thread or episode" };
  if (!keepId || !mergeId) return { ok: false, status: 400, error: "keepId and mergeId are required" };
  if (keepId === mergeId) return { ok: false, status: 400, error: "keepId and mergeId must differ" };
  const now = Date.now();

  if (target === "fact") {
    const keep = state.facts.find((item) => item.id === keepId);
    const duplicate = state.facts.find((item) => item.id === mergeId);
    if (!keep || !duplicate) return { ok: false, status: 404, error: "Fact not found" };
    keep.evidenceMessageIds = [...new Set([...keep.evidenceMessageIds, ...duplicate.evidenceMessageIds])];
    keep.entityIds = [...new Set([...(keep.entityIds ?? []), ...(duplicate.entityIds ?? [])])];
    keep.confidence = Math.max(keep.confidence, duplicate.confidence);
    keep.importance = Math.max(keep.importance, duplicate.importance);
    keep.pinned = keep.pinned === true || duplicate.pinned === true;
    if (duplicate.needsReview || keep.needsReview) keep.needsReview = true;
    keep.visibleTo = keep.visibleTo === "all" || duplicate.visibleTo === "all" ? "all" : [...new Set([...keep.visibleTo, ...duplicate.visibleTo])];
    keep.validUntilMessageId = keep.validUntilMessageId ?? duplicate.validUntilMessageId;
    keep.updatedAt = now;
    state.facts = state.facts.filter((item) => item.id !== mergeId);
    return { ok: true };
  }

  if (target === "thread") {
    const keep = state.threads.find((item) => item.id === keepId);
    const duplicate = state.threads.find((item) => item.id === mergeId);
    if (!keep || !duplicate) return { ok: false, status: 404, error: "Thread not found" };
    keep.evidenceMessageIds = [...new Set([...keep.evidenceMessageIds, ...duplicate.evidenceMessageIds])];
    keep.participantIds = [...new Set([...keep.participantIds, ...duplicate.participantIds])];
    keep.priority = Math.max(keep.priority, duplicate.priority);
    keep.lastMentionedAt = Math.max(keep.lastMentionedAt, duplicate.lastMentionedAt);
    keep.pinned = keep.pinned === true || duplicate.pinned === true;
    if (duplicate.needsReview || keep.needsReview) keep.needsReview = true;
    keep.resolutionCondition = keep.resolutionCondition ?? duplicate.resolutionCondition;
    state.threads = state.threads.filter((item) => item.id !== mergeId);
    return { ok: true };
  }

  const keep = state.episodes.find((item) => item.id === keepId);
  const duplicate = state.episodes.find((item) => item.id === mergeId);
  if (!keep || !duplicate) return { ok: false, status: 404, error: "Episode not found" };
  keep.sourceMessageIds = [...new Set([...keep.sourceMessageIds, ...duplicate.sourceMessageIds])];
  keep.participantIds = [...new Set([...keep.participantIds, ...duplicate.participantIds])];
  keep.emotionalWeight = Math.max(keep.emotionalWeight ?? 0, duplicate.emotionalWeight ?? 0);
  keep.pinned = keep.pinned === true || duplicate.pinned === true;
  keep.location = keep.location ?? duplicate.location;
  keep.outcome = keep.outcome ?? duplicate.outcome;
  keep.occurredAt = keep.occurredAt ?? duplicate.occurredAt;
  state.episodes = state.episodes.filter((item) => item.id !== mergeId);
  return { ok: true };
}

/** Merges two items the extractor recorded twice. */
activeMemoryRouter.post("/:id/memory/merge", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  const body = req.body as { target?: unknown; keepId?: unknown; mergeId?: unknown };
  const target = typeof body.target === "string" ? (body.target as MemoryItemType) : ("" as MemoryItemType);
  const keepId = shortId(body.keepId);
  const mergeId = shortId(body.mergeId);

  if (!MEMORY_ITEM_TYPES.has(target)) {
    res.status(400).json({ error: "target must be fact, thread or episode" });
    return;
  }
  if (!keepId || !mergeId) {
    res.status(400).json({ error: "keepId and mergeId are required" });
    return;
  }

  const updated = await updateActiveMemory(
    req.params.id,
    (draft) => mergeMemoryItems(draft, target, keepId, mergeId),
    { revision: { source: "manual", summary: `Merged ${target} ${mergeId} into ${keepId}` } },
  );
  const result = updated.result;
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ memory: updated.state });
});

/** Undoes the newest memory revision (or a specific one). */
activeMemoryRouter.post("/:id/memory/rollback", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  const body = req.body as { revisionId?: unknown };
  const restored = await rollbackActiveMemory(req.params.id, shortId(body.revisionId) || undefined);
  if (!restored) {
    res.status(409).json(apiErrorBody("memory.noRevision"));
    return;
  }
  res.json({ memory: restored });
});

activeMemoryRouter.delete("/:id/memory", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  await deleteActiveMemory(req.params.id);
  res.status(204).end();
});
