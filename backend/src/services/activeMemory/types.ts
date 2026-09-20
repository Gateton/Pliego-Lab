export const ACTIVE_MEMORY_VERSION = 1 as const;

export type MemoryExtractionMode = "heuristic" | "llm" | "auto";
export type MemoryFactStatus = "candidate" | "confirmed" | "disputed" | "invalidated";
export type MemoryThreadStatus = "open" | "snoozed" | "resolved" | "abandoned";
export type MemoryThreadKind =
  | "promise"
  | "question"
  | "goal"
  | "threat"
  | "secret"
  | "plan"
  | "conflict"
  | "clue"
  | "interrupted_action";

export type MemoryScopeMode = "chat" | "shared";

/** Optional semantic layer. Disabled by default: lexical + entity scoring works offline. */
export interface SemanticRetrievalSettings {
  enabled: boolean;
  model: string;
  /** Cosine similarity below this is treated as noise. */
  minScore: number;
}

/**
 * A shared ledger lets several chats of the same world or character remember the same canon.
 * It is opt-in per chat: `mode: "chat"` (default) keeps everything private to one conversation.
 */
export interface MemoryScope {
  mode: MemoryScopeMode;
  /** World/character key used when `mode` is "shared". */
  key: string;
}

export interface ActiveMemorySettings {
  enabled: boolean;
  extractionMode: MemoryExtractionMode;
  model: string;
  maxFacts: number;
  maxThreads: number;
  maxEpisodes: number;
  maxBriefItems: number;
  maxBriefCharacters: number;
  /** Share of the context window the brief may occupy. Used when `relateBudgetToContext` is true. */
  briefBudgetPercent: number;
  /** When true the compiled brief is bounded by the active presets' context window, not a fixed size. */
  relateBudgetToContext: boolean;
  semantic: SemanticRetrievalSettings;
  scope: MemoryScope;
  /** Visual/outfit facts are skipped: Image Director already owns that state. */
  deferVisualFactsToDirector: boolean;
}

export interface SceneState {
  location?: string;
  narrativeTime?: string;
  presentCharacterIds: string[];
  positions: Record<string, string>;
  relevantObjects: string[];
  immediateGoal?: string;
  pendingAction?: string;
  tone?: string;
  tension?: string;
  lastSignificantChange?: string;
  evidenceMessageIds: string[];
  updatedAt?: number;
}

export interface MemoryFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  status: MemoryFactStatus;
  confidence: number;
  importance: number;
  visibleTo: string[] | "all";
  evidenceMessageIds: string[];
  validFromMessageId: string;
  validUntilMessageId?: string;
  pinned?: boolean;
  /** NPC/character identifiers this fact is about, resolved at extraction time. */
  entityIds: string[];
  /** Set when the evidence behind this fact was edited or removed and a human should re-check it. */
  needsReview?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryThread {
  id: string;
  title: string;
  kind: MemoryThreadKind;
  status: MemoryThreadStatus;
  participantIds: string[];
  evidenceMessageIds: string[];
  priority: number;
  lastMentionedAt: number;
  resolutionCondition?: string;
  pinned?: boolean;
  /** Set when the evidence behind this thread changed and a human should re-check it. */
  needsReview?: boolean;
}

export interface MemoryEpisode {
  id: string;
  summary: string;
  participantIds: string[];
  location?: string;
  outcome?: string;
  emotionalWeight?: number;
  sourceMessageIds: string[];
  occurredAt?: string;
  createdAt: number;
  pinned?: boolean;
  /** Embedding of `summary`, filled only when semantic retrieval is enabled. */
  embedding?: number[];
}

export interface GuardFinding {
  factId: string;
  excerpt: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface GuardReport {
  checkedAt: number;
  messageId?: string;
  method: "heuristic" | "llm" | "heuristic-fallback";
  findings: GuardFinding[];
  warnings: string[];
}

export type MemoryItemType = "fact" | "thread" | "episode";

export interface MemoryBriefSelection {
  type: MemoryItemType;
  id: string;
  score: number;
  reasons: string[];
}

export interface MemoryBriefTrace {
  query: string;
  responderId?: string;
  generatedAt: number;
  selected: MemoryBriefSelection[];
  omittedCount: number;
  brief: string;
}

export interface ActiveMemorySnapshot {
  version: typeof ACTIVE_MEMORY_VERSION;
  settings: ActiveMemorySettings;
  scene: SceneState;
  facts: MemoryFact[];
  threads: MemoryThread[];
  episodes: MemoryEpisode[];
  lastProcessedMessageId?: string;
  lastBrief?: MemoryBriefTrace;
}

export interface MemoryRevision {
  id: string;
  createdAt: number;
  source: "manual" | "extraction" | "rollback";
  summary: string;
  before: ActiveMemorySnapshot;
}

export interface ActiveMemoryState extends ActiveMemorySnapshot {
  revisions: MemoryRevision[];
  /** Result of the last Continuity Guard pass over a generated reply. */
  lastGuard?: GuardReport;
  /** Vector cache keyed by item id ("fact:<id>", "episode:<id>"): only used when semantic is on. */
  embeddings?: Record<string, number[]>;
}

export interface MemoryExtractionInput {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface ExtractedScenePatch {
  location?: string;
  narrativeTime?: string;
  presentCharacterIds?: string[];
  relevantObjects?: string[];
  immediateGoal?: string;
  pendingAction?: string;
  tone?: string;
  tension?: string;
  lastSignificantChange?: string;
  evidenceMessageIds?: string[];
}

export interface ExtractedFact {
  subject: string;
  predicate: string;
  object: string;
  confidence?: number;
  importance?: number;
  visibleTo?: string[] | "all";
  evidenceMessageIds: string[];
  status?: MemoryFactStatus;
  pinned?: boolean;
}

export interface ExtractedThread {
  title: string;
  kind: MemoryThreadKind;
  participantIds?: string[];
  evidenceMessageIds: string[];
  priority?: number;
  /** Signal score 0..1; candidates below the extractor threshold are never emitted. */
  confidence?: number;
  status?: MemoryThreadStatus;
  resolutionCondition?: string;
  pinned?: boolean;
}

export interface ExtractedEpisode {
  summary: string;
  participantIds?: string[];
  location?: string;
  outcome?: string;
  emotionalWeight?: number;
  /** Signal score 0..1; candidates below the extractor threshold are never emitted. */
  confidence?: number;
  sourceMessageIds: string[];
  occurredAt?: string;
  pinned?: boolean;
}

export interface MemoryExtractionDraft {
  scene?: ExtractedScenePatch;
  facts: ExtractedFact[];
  threads: ExtractedThread[];
  episodes: ExtractedEpisode[];
}

export interface MemoryExtractionReport {
  requestedMode: MemoryExtractionMode;
  method: "heuristic" | "llm" | "heuristic-fallback";
  processedMessageIds: string[];
  addedFacts: number;
  updatedFacts: number;
  addedThreads: number;
  updatedThreads: number;
  addedEpisodes: number;
  updatedScene: boolean;
  warnings: string[];
}

/** What an invalidation pass touched, so the UI can explain it instead of silently rewriting canon. */
export interface MemoryInvalidationReport {
  messageIds: string[];
  reason: string;
  factsMarkedForReview: number;
  threadsMarkedForReview: number;
  episodesRemoved: number;
  rewoundToMessageId?: string;
}
