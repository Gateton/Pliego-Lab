import type {
  ActiveMemoryPatch,
  ActiveMemoryState,
  GuardReport,
  MemoryBriefPreview,
  MemoryExtractionMode,
  MemoryExtractionReport,
  MemoryInvalidationReport,
} from "../types/activeMemory";
import { t } from "../i18n";
import { errorFromBody } from "./requestError";

function unwrapMemory(payload: ActiveMemoryState | { memory: ActiveMemoryState }): ActiveMemoryState {
  return "memory" in payload ? payload.memory : payload;
}

async function asMemory(response: Response): Promise<ActiveMemoryState> {
  const body = await response.json().catch(() => null) as
    | ActiveMemoryState
    | { memory: ActiveMemoryState }
    | { error?: string }
    | null;

  if (!response.ok) {
    throw errorFromBody(body, response.status, t("memory.api.loadFailed", { status: response.status }));
  }
  if (!body || typeof body !== "object" || (!("memory" in body) && !("version" in body))) {
    throw new Error(t("memory.api.invalidResponse"));
  }
  return unwrapMemory(body as ActiveMemoryState | { memory: ActiveMemoryState });
}

export function getActiveMemory(chatId: string, signal?: AbortSignal): Promise<ActiveMemoryState> {
  return fetch(`/api/chats/${encodeURIComponent(chatId)}/memory`, { signal }).then(asMemory);
}

export async function patchActiveMemory(chatId: string, mutation: ActiveMemoryPatch): Promise<ActiveMemoryState> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation),
  });

  if (response.status === 204) return getActiveMemory(chatId);
  return asMemory(response);
}

/**
 * Compiles the brief for a turn. `persist` records the trace so the panel can show what the model
 * actually received; generation uses it without persisting, so a preview never rewrites history.
 */
export async function retrieveMemoryBrief(
  chatId: string,
  options: { query?: string; responderId?: string; persist?: boolean; maxContextTokens?: number } = {},
  signal?: AbortSignal,
): Promise<MemoryBriefPreview> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
    signal,
  });
  const body = await response.json().catch(() => null) as MemoryBriefPreview | { error?: string } | null;
  if (!response.ok) {
    throw errorFromBody(body, response.status, t("memory.api.retrieveFailed", { status: response.status }));
  }
  if (!body || typeof body !== "object" || !("brief" in body)) {
    throw new Error(t("memory.api.invalidResponse"));
  }
  return body as MemoryBriefPreview;
}

export interface MemoryExtractionResult {
  memory: ActiveMemoryState;
  report: MemoryExtractionReport | null;
  skipped?: string;
}

export async function extractActiveMemory(
  chatId: string,
  options: { mode?: MemoryExtractionMode; model?: string; all?: boolean } = {},
): Promise<MemoryExtractionResult> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const body = await response.json().catch(() => null) as MemoryExtractionResult | { error?: string } | null;
  if (!response.ok) {
    throw errorFromBody(body, response.status, t("memory.api.updateFailed", { status: response.status }));
  }
  return body as MemoryExtractionResult;
}

export async function rollbackActiveMemory(chatId: string, revisionId?: string): Promise<ActiveMemoryState> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(revisionId ? { revisionId } : {}),
  });
  return asMemory(response);
}

/** Marks the memory that cited the given messages as needing review (edits, deletions, swipes). */
export async function invalidateMemory(
  chatId: string,
  options: { messageIds: string[]; reason: string },
): Promise<{ memory: ActiveMemoryState; report: MemoryInvalidationReport }> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory/invalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const body = await response.json().catch(() => null) as
    | { memory: ActiveMemoryState; report: MemoryInvalidationReport }
    | { error?: string }
    | null;
  if (!response.ok) {
    throw errorFromBody(body, response.status, t("memory.api.invalidateFailed", { status: response.status }));
  }
  return body as { memory: ActiveMemoryState; report: MemoryInvalidationReport };
}

/** Merges a duplicate item into the one that should survive. */
export async function mergeMemoryItems(
  chatId: string,
  options: { target: "fact" | "thread" | "episode"; keepId: string; mergeId: string },
): Promise<ActiveMemoryState> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return asMemory(response);
}

/** Runs the Continuity Guard over a generated reply and stores the findings. */
export async function guardMemory(
  chatId: string,
  options: { responseText: string; messageId?: string; responderId?: string },
): Promise<{ memory: ActiveMemoryState; report: GuardReport }> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/memory/guard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const body = await response.json().catch(() => null) as
    | { memory: ActiveMemoryState; report: GuardReport }
    | { error?: string }
    | null;
  if (!response.ok) {
    throw errorFromBody(body, response.status, t("memory.api.guardFailed", { status: response.status }));
  }
  return body as { memory: ActiveMemoryState; report: GuardReport };
}
