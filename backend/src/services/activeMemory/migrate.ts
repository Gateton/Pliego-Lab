import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataPath } from "../paths.js";
import { normalizeActiveMemoryState, snapshotState } from "./store.js";
import { ACTIVE_MEMORY_VERSION, type ActiveMemoryState } from "./types.js";

export const MIGRATION_V2_REVISION_ID = "migration-v2";

/**
 * Pure v1 → v2 transform. v1 switched memory on in every chat and extracted it with surface
 * heuristics, which filled ledgers with quoted questions and copied sentences. v2 is opt-in and
 * LLM-extracted, so a v1 ledger is:
 *   - switched off (the user never chose to turn it on; the old default did),
 *   - moved to LLM extraction when it was still on the heuristic default,
 *   - cleared of everything it extracted, except what the user pinned, and rewound so that turning
 *     it on later re-reads the recent history with the model instead of resuming after the junk.
 * The pre-migration content stays reachable as a revision, so the user can roll it back.
 */
export function migrateLedgerToV2(state: ActiveMemoryState): ActiveMemoryState {
  const settings: ActiveMemoryState["settings"] = {
    ...state.settings,
    enabled: false,
    extractionMode: state.settings.extractionMode === "heuristic" ? "llm" : state.settings.extractionMode,
  };
  // Rolling the migration back restores the old content only; it does not switch memory back on.
  const before = { ...snapshotState(state), version: ACTIVE_MEMORY_VERSION, settings };
  const removed =
    state.facts.filter((item) => !item.pinned).length +
    state.threads.filter((item) => !item.pinned).length +
    state.episodes.filter((item) => !item.pinned).length;
  const createdAt = Math.max(0, ...state.revisions.map((revision) => revision.createdAt ?? 0));
  const migrated: ActiveMemoryState = {
    version: ACTIVE_MEMORY_VERSION,
    settings,
    scene: { presentCharacterIds: [], positions: {}, relevantObjects: [], evidenceMessageIds: [] },
    facts: state.facts.filter((item) => item.pinned),
    threads: state.threads.filter((item) => item.pinned),
    episodes: state.episodes.filter((item) => item.pinned),
    revisions: [
      ...state.revisions,
      {
        id: MIGRATION_V2_REVISION_ID,
        createdAt,
        source: "manual",
        summary: `Memoria Viva v2: memory turned off by default and ${removed} heuristic item(s) cleared`,
        before,
      },
    ],
    ...(state.embeddings ? { embeddings: state.embeddings } : {}),
  };
  return migrated;
}

/** Rewrites every v1 ledger in `dir` once. Idempotent: v2 files are left untouched. */
export async function migrateActiveMemoryLedgers(dir = dataPath("memory")): Promise<number> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let migrated = 0;
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const file = path.join(dir, entry);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, "utf-8"));
    } catch {
      continue; // an unreadable ledger is left for the store to report, not rewritten here
    }
    const version = raw && typeof raw === "object" ? (raw as { version?: unknown }).version : undefined;
    if (typeof version === "number" && version >= ACTIVE_MEMORY_VERSION) continue;
    const next = migrateLedgerToV2(normalizeActiveMemoryState(raw));
    const temporary = `${file}.tmp`;
    await writeFile(temporary, JSON.stringify(next, null, 2), "utf-8");
    await rename(temporary, file);
    migrated += 1;
  }
  return migrated;
}
