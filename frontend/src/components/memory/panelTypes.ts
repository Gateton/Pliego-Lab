import type {
  ActiveMemoryPatch,
  ActiveMemoryState,
  ActiveMemorySettingsPatch,
  MemoryBriefPreview,
  MemoryExtractionMode,
  MemoryExtractionReport,
} from "../../types/activeMemory";
import type {
  MemoryExtractionOutcome,
  MemoryFactPatch,
  MemoryMergeTarget,
  MemoryThreadPatch,
} from "../../hooks/useActiveMemory";

export type { MemoryExtractionOutcome, MemoryFactPatch, MemoryMergeTarget, MemoryThreadPatch };

/**
 * Everything the panel needs from its host. The panel is presentational on purpose: it never talks
 * to the API itself, so the chat view decides when to refresh, which chat to act on and how the
 * callbacks are wired.
 *
 * `savingIds` uses the hook's key convention: `fact:<id>`, `thread:<id>`, `settings`.
 */
export interface ActiveMemoryPanelProps {
  /** Stored memory for the open chat, or null before it has loaded. */
  memory: ActiveMemoryState | null;
  loading: boolean;
  /** Load or save failure reported by the host. */
  error: string | null;
  /** Item keys currently being saved, so each row can show its own spinner. */
  savingIds: Set<string>;
  onRetry: () => void;
  /** Edits one fact (pin, status, visibility, review flag). */
  onUpdateFact: (id: string, patch: MemoryFactPatch) => Promise<void>;
  /** Edits one thread (status, pin, title). */
  onUpdateThread: (id: string, patch: MemoryThreadPatch) => Promise<void>;
  /** Flips Memoria Viva on/off for this chat. Falls back to `onUpdateSettings`. */
  onToggleEnabled?: (enabled: boolean) => Promise<void>;
  /** Saves any subset of the settings, including `semantic` and `scope`. */
  onUpdateSettings?: (patch: ActiveMemorySettingsPatch) => Promise<void>;
  /** Generic patch escape hatch, used when the specific callbacks are not provided. */
  onUpdateItem?: (patch: ActiveMemoryPatch) => Promise<void>;
  /** Folds a duplicate item into the one that should survive. Enables the merge UI. */
  onMerge?: (target: MemoryMergeTarget, keepId: string, mergeId: string) => Promise<void>;
  /** Restores a revision, or the newest one when no id is given. */
  onRollback?: (revisionId?: string) => Promise<void>;
  /** Runs extraction now; `options.all` reprocesses the whole history. */
  onRunExtraction?: (mode?: MemoryExtractionMode, options?: { all?: boolean }) => Promise<MemoryExtractionOutcome>;
  /** Compiles what the model would receive without persisting anything. */
  onPreviewBrief?: (query: string, responderId?: string) => Promise<MemoryBriefPreview>;
  /** Character names (or ids) used as the vocabulary for `visibleTo`. */
  knownNames?: string[];
  /** Jumps to the source message of an evidence chip. */
  onGoToMessage?: (messageId: string) => void;
  /** Last manual extraction result, shown in Ajustes. */
  lastExtractionReport?: MemoryExtractionReport | null;
}
