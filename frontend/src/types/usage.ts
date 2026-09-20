import type { ProviderId } from "./provider";

export type UsageStage =
  | "main"
  | "director"
  | "recast"
  | "npcTracker"
  | "memory"
  | "memoryPlus"
  | "characterGen";

/** Token/cost accounting for one call. Nullable fields mean "the provider didn't report it". */
export interface UsageEvent {
  id: string;
  chatId: string | null;
  stage: UsageStage;
  provider: ProviderId;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  timestamp: number;
  /** Legacy fields — present only on events recorded before usage was normalized. */
  promptTokens?: number;
  completionTokens?: number;
}
