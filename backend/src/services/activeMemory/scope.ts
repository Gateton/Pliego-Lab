import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataPath } from "../paths.js";
import type { ActiveMemoryState, MemoryEpisode, MemoryFact, MemoryScope, MemoryThread } from "./types.js";

/**
 * Shared ledgers.
 *
 * By default a ledger belongs to exactly one chat, which is what most people expect: playing a new
 * scenario should not inherit the previous one's canon. When the user turns on a shared scope, every
 * chat pointing at the same key (usually the character or the world) reads and writes one ledger, so
 * a long campaign split across several chats still remembers itself.
 *
 * The merge is read-mostly: the chat's own ledger stays on disk untouched, and the shared ledger is
 * folded in at read time. That keeps disabling the feature a no-op instead of a data migration.
 */

export interface SharedLedgerStoreOptions {
  dataDir?: string;
  now?: () => number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function safeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Shared memory key is required");
  return trimmed.replace(/[^0-9a-z._-]/gi, "_").slice(0, 96);
}

function factKey(fact: MemoryFact): string {
  return `${fact.predicate.toLocaleLowerCase()}|${fact.object.toLocaleLowerCase()}`;
}

function threadKey(thread: MemoryThread): string {
  return thread.title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function episodeKey(episode: MemoryEpisode): string {
  return episode.summary.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export interface SharedLedgerMerge {
  facts: MemoryFact[];
  threads: MemoryThread[];
  episodes: MemoryEpisode[];
  addedFromShared: number;
}

export function createSharedLedgerStore(options: SharedLedgerStoreOptions = {}) {
  const dataDir = options.dataDir ?? dataPath("memory-shared");
  const dirReady = mkdir(dataDir, { recursive: true });

  async function read(key: string): Promise<ActiveMemoryState | null> {
    await dirReady;
    try {
      const raw = await readFile(path.join(dataDir, `${safeKey(key)}.json`), "utf-8");
      return JSON.parse(raw) as ActiveMemoryState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function write(key: string, state: ActiveMemoryState): Promise<void> {
    await dirReady;
    const target = path.join(dataDir, `${safeKey(key)}.json`);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf-8");
    await rename(temporary, target);
  }

  return { read, write };
}

/**
 * Folds a shared ledger into a chat ledger. The chat always wins on conflicts: what happened in this
 * conversation is more authoritative than what another conversation recorded, and the user must be
 * able to correct a shared entry without it being overwritten on the next turn.
 */
export function mergeSharedLedger(local: ActiveMemoryState, shared: ActiveMemoryState | null): SharedLedgerMerge {
  if (!shared) return { facts: clone(local.facts), threads: clone(local.threads), episodes: clone(local.episodes), addedFromShared: 0 };

  let addedFromShared = 0;
  const facts = clone(local.facts);
  const threads = clone(local.threads);
  const episodes = clone(local.episodes);

  const localFactKeys = new Set(facts.map((fact) => `${fact.subject.toLocaleLowerCase()}|${factKey(fact)}`));
  for (const fact of shared.facts) {
    if (fact.status === "invalidated" || fact.validUntilMessageId) continue;
    const key = `${fact.subject.toLocaleLowerCase()}|${factKey(fact)}`;
    if (localFactKeys.has(key)) continue;
    localFactKeys.add(key);
    facts.push({ ...fact, needsReview: false });
    addedFromShared += 1;
  }

  const localThreadKeys = new Set(threads.map(threadKey));
  for (const thread of shared.threads) {
    if (thread.status === "resolved" || thread.status === "abandoned") continue;
    const key = threadKey(thread);
    if (localThreadKeys.has(key)) continue;
    localThreadKeys.add(key);
    threads.push({ ...clone(thread) });
    addedFromShared += 1;
  }

  const localEpisodeKeys = new Set(episodes.map(episodeKey));
  for (const episode of shared.episodes) {
    const key = episodeKey(episode);
    if (localEpisodeKeys.has(key)) continue;
    localEpisodeKeys.add(key);
    episodes.push({ ...clone(episode) });
    addedFromShared += 1;
  }

  return { facts, threads, episodes, addedFromShared };
}

/** Publishes the chat's current canon into its shared ledger, keeping newer entries. */
export function publishToSharedLedger(local: ActiveMemoryState, shared: ActiveMemoryState | null): ActiveMemoryState {
  const merged = mergeSharedLedger(local, shared);
  return {
    ...(shared ?? local),
    facts: merged.facts,
    threads: merged.threads,
    episodes: merged.episodes,
    settings: { ...local.settings, scope: { ...local.settings.scope } },
    revisions: [],
  };
}

export function scopeIsShared(scope: MemoryScope | undefined): boolean {
  return scope?.mode === "shared" && scope.key.trim().length > 0;
}
