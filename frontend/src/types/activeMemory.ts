/**
 * Mirror of the backend's active-memory contract (backend/src/services/activeMemory/types.ts).
 * The backend is the source of truth: every field here exists so the panel can render stored state
 * without guessing, and unknown extras stay readable through the index signatures.
 */

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

export interface SemanticRetrievalSettings {
  enabled: boolean;
  model: string;
  minScore: number;
}

export interface MemoryScope {
  mode: MemoryScopeMode;
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
  briefBudgetPercent: number;
  relateBudgetToContext: boolean;
  semantic: SemanticRetrievalSettings;
  scope: MemoryScope;
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
  entityIds: string[];
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
}

export interface MemoryBriefSelection {
  type: "fact" | "thread" | "episode";
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

export interface MemoryRevision {
  id: string;
  createdAt: number;
  source: "manual" | "extraction" | "rollback";
  summary: string;
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

export interface MemoryInvalidationReport {
  messageIds: string[];
  reason: string;
  factsMarkedForReview: number;
  threadsMarkedForReview: number;
  episodesRemoved: number;
  rewoundToMessageId?: string;
}

export interface ActiveMemoryState {
  version: number;
  settings: ActiveMemorySettings;
  scene: SceneState;
  facts: MemoryFact[];
  threads: MemoryThread[];
  episodes: MemoryEpisode[];
  revisions?: MemoryRevision[];
  lastProcessedMessageId?: string;
  lastBrief?: MemoryBriefTrace;
  lastGuard?: GuardReport;
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

export interface MemoryBriefPreview {
  brief: string;
  trace: MemoryBriefTrace;
}

export type ActiveMemorySettingsPatch = Partial<
  Pick<
    ActiveMemorySettings,
    | "enabled"
    | "model"
    | "extractionMode"
    | "maxFacts"
    | "maxThreads"
    | "maxEpisodes"
    | "maxBriefItems"
    | "maxBriefCharacters"
    | "briefBudgetPercent"
    | "relateBudgetToContext"
    | "deferVisualFactsToDirector"
  >
> & {
  semantic?: Partial<SemanticRetrievalSettings>;
  scope?: Partial<MemoryScope>;
};

export type ActiveMemoryPatch =
  | { target: "fact"; id: string; patch: Partial<Pick<MemoryFact, "pinned" | "status" | "visibleTo" | "needsReview">> }
  | { target: "thread"; id: string; patch: Partial<Pick<MemoryThread, "status" | "pinned" | "title">> }
  | { target: "settings"; patch: ActiveMemorySettingsPatch };
