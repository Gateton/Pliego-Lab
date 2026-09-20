import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ACTIVE_MEMORY_VERSION,
  type ActiveMemorySettings,
  type ActiveMemorySnapshot,
  type ActiveMemoryState,
  type MemoryRevision,
  type SceneState,
} from "./types.js";

export const DEFAULT_ACTIVE_MEMORY_SETTINGS: ActiveMemorySettings = {
  enabled: true,
  extractionMode: "heuristic",
  model: "",
  maxFacts: 12,
  maxThreads: 6,
  maxEpisodes: 3,
  maxBriefItems: 16,
  maxBriefCharacters: 6_000,
  // 10% of the context window sits inside the 8-12% the design reserved for memory.
  briefBudgetPercent: 10,
  relateBudgetToContext: true,
  semantic: { enabled: false, model: "", minScore: 0.35 },
  scope: { mode: "chat", key: "" },
  deferVisualFactsToDirector: true,
};

export const DEFAULT_SCENE_STATE: SceneState = {
  presentCharacterIds: [],
  positions: {},
  relevantObjects: [],
  evidenceMessageIds: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
}

function normalizeScene(scene: Partial<SceneState> | undefined): SceneState {
  const positions = scene?.positions && typeof scene.positions === "object" && !Array.isArray(scene.positions)
    ? Object.fromEntries(
        Object.entries(scene.positions).filter(
          (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
        ),
      )
    : {};
  return {
    ...DEFAULT_SCENE_STATE,
    ...scene,
    presentCharacterIds: uniqueStrings(scene?.presentCharacterIds),
    positions,
    relevantObjects: uniqueStrings(scene?.relevantObjects),
    evidenceMessageIds: uniqueStrings(scene?.evidenceMessageIds),
  };
}

export function createDefaultActiveMemoryState(): ActiveMemoryState {
  return {
    version: ACTIVE_MEMORY_VERSION,
    settings: { ...DEFAULT_ACTIVE_MEMORY_SETTINGS },
    scene: clone(DEFAULT_SCENE_STATE),
    facts: [],
    threads: [],
    episodes: [],
    revisions: [],
  };
}

export function snapshotState(state: ActiveMemoryState): ActiveMemorySnapshot {
  const { revisions: _revisions, ...snapshot } = state;
  return clone(snapshot);
}

export function normalizeActiveMemoryState(value: unknown): ActiveMemoryState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createDefaultActiveMemoryState();
  const state = value as Partial<ActiveMemoryState>;
  return {
    version: ACTIVE_MEMORY_VERSION,
    settings: normalizeSettings(state.settings),
    scene: normalizeScene(state.scene),
    facts: Array.isArray(state.facts) ? state.facts.map((fact) => ({ ...fact, entityIds: Array.isArray(fact.entityIds) ? fact.entityIds : [] })) : [],
    threads: Array.isArray(state.threads) ? state.threads : [],
    episodes: Array.isArray(state.episodes) ? state.episodes : [],
    revisions: Array.isArray(state.revisions) ? state.revisions : [],
    ...(typeof state.lastProcessedMessageId === "string"
      ? { lastProcessedMessageId: state.lastProcessedMessageId }
      : {}),
    ...(state.lastBrief && typeof state.lastBrief === "object" ? { lastBrief: state.lastBrief } : {}),
    ...(state.lastGuard && typeof state.lastGuard === "object" ? { lastGuard: state.lastGuard } : {}),
    ...(state.embeddings && typeof state.embeddings === "object" ? { embeddings: state.embeddings } : {}),
  };
}

/** Ledgers written before a setting existed must still load, so every field falls back on its own. */
function normalizeSettings(value: unknown): ActiveMemorySettings {
  const partial = (value ?? {}) as Partial<ActiveMemorySettings>;
  return {
    ...DEFAULT_ACTIVE_MEMORY_SETTINGS,
    ...partial,
    semantic: { ...DEFAULT_ACTIVE_MEMORY_SETTINGS.semantic, ...(partial.semantic ?? {}) },
    scope: { ...DEFAULT_ACTIVE_MEMORY_SETTINGS.scope, ...(partial.scope ?? {}) },
  };
}

export interface ActiveMemoryStoreOptions {
  dataDir?: string;
  now?: () => number;
  idFactory?: () => string;
  maxRevisions?: number;
}

export interface MemoryTransactionOptions {
  revision?: {
    source: MemoryRevision["source"];
    summary: string;
  };
}

export interface MemoryTransactionResult<T> {
  state: ActiveMemoryState;
  result: T;
}

export function createActiveMemoryStore(options: ActiveMemoryStoreOptions = {}) {
  const dataDir = options.dataDir ?? path.resolve(process.cwd(), "data", "memory");
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? randomUUID;
  const maxRevisions = options.maxRevisions ?? 50;
  const dirReady = mkdir(dataDir, { recursive: true });
  const opQueues = new Map<string, Promise<unknown>>();

  function assertChatId(chatId: string): void {
    if (!/^[0-9a-z][0-9a-z_-]{0,127}$/i.test(chatId)) throw new Error("Invalid chat id");
  }

  function memoryPath(chatId: string): string {
    assertChatId(chatId);
    return path.join(dataDir, `${chatId}.json`);
  }

  function enqueue<T>(chatId: string, operation: () => Promise<T>): Promise<T> {
    const previous = opQueues.get(chatId) ?? Promise.resolve();
    const result = previous.then(operation);
    opQueues.set(chatId, result.catch(() => undefined));
    return result;
  }

  async function readFileState(chatId: string): Promise<ActiveMemoryState | null> {
    await dirReady;
    try {
      const raw = await readFile(memoryPath(chatId), "utf-8");
      return normalizeActiveMemoryState(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function writeState(chatId: string, state: ActiveMemoryState): Promise<void> {
    await dirReady;
    const target = memoryPath(chatId);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf-8");
    await rename(temporary, target);
  }

  async function get(chatId: string): Promise<ActiveMemoryState> {
    return (await readFileState(chatId)) ?? createDefaultActiveMemoryState();
  }

  async function peek(chatId: string): Promise<ActiveMemoryState | null> {
    return readFileState(chatId);
  }

  async function transaction<T>(
    chatId: string,
    updater: (draft: ActiveMemoryState) => T | Promise<T>,
    transactionOptions: MemoryTransactionOptions = {},
  ): Promise<MemoryTransactionResult<T>> {
    return enqueue(chatId, async () => {
      const current = (await readFileState(chatId)) ?? createDefaultActiveMemoryState();
      const before = snapshotState(current);
      const draft = clone(current);
      const result = await updater(draft);
      const materiallyChanged = JSON.stringify(snapshotState(draft)) !== JSON.stringify(before);

      if (materiallyChanged && transactionOptions.revision) {
        draft.revisions.push({
          id: idFactory(),
          createdAt: now(),
          source: transactionOptions.revision.source,
          summary: transactionOptions.revision.summary,
          before,
        });
        if (draft.revisions.length > maxRevisions) {
          draft.revisions = draft.revisions.slice(-maxRevisions);
        }
      }

      if (materiallyChanged) await writeState(chatId, draft);
      return { state: draft, result };
    });
  }

  async function rollback(chatId: string, revisionId?: string): Promise<ActiveMemoryState | null> {
    return enqueue(chatId, async () => {
      const current = await readFileState(chatId);
      if (!current || current.revisions.length === 0) return null;
      const target = revisionId
        ? current.revisions.find((revision) => revision.id === revisionId)
        : current.revisions[current.revisions.length - 1];
      if (!target) return null;

      const restored: ActiveMemoryState = {
        ...clone(target.before),
        revisions: clone(current.revisions),
      };
      restored.revisions.push({
        id: idFactory(),
        createdAt: now(),
        source: "rollback",
        summary: `Rollback of ${target.id}: ${target.summary}`,
        before: snapshotState(current),
      });
      if (restored.revisions.length > maxRevisions) restored.revisions = restored.revisions.slice(-maxRevisions);
      await writeState(chatId, restored);
      return restored;
    });
  }

  async function remove(chatId: string): Promise<boolean> {
    return enqueue(chatId, async () => {
      await dirReady;
      try {
        await rm(memoryPath(chatId));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    });
  }

  return { get, peek, transaction, rollback, remove };
}

const defaultStore = createActiveMemoryStore();

export const getActiveMemory = defaultStore.get;
export const peekActiveMemory = defaultStore.peek;
export const updateActiveMemory = defaultStore.transaction;
export const rollbackActiveMemory = defaultStore.rollback;
export const deleteActiveMemory = defaultStore.remove;
