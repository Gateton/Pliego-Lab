// Shared HTTP plumbing for every provider adapter: idle-timeout handling (so a silently dead
// connection can never hang a request forever), request/response logging, and small parsing
// helpers. Kept separate so native (non-OpenAI-shaped) adapters reuse it instead of duplicating.

import type { ChatMessage } from "./types.js";

export const IDLE_TIMEOUT_MS = 90_000;

export interface IdleController {
  signal: AbortSignal;
  bump(): void;
  dispose(): void;
  timedOut: boolean;
}

export function createIdleController(externalSignal: AbortSignal): IdleController {
  const controller = new AbortController();
  const state: IdleController = {
    signal: controller.signal,
    timedOut: false,
    bump() {
      clearTimeout(timer);
      timer = setTimeout(fire, IDLE_TIMEOUT_MS);
    },
    dispose() {
      clearTimeout(timer);
      externalSignal.removeEventListener("abort", onExternalAbort);
    },
  };
  const fire = () => {
    state.timedOut = true;
    controller.abort();
  };
  const onExternalAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal.aborted) controller.abort(externalSignal.reason);
  else externalSignal.addEventListener("abort", onExternalAbort);
  let timer = setTimeout(fire, IDLE_TIMEOUT_MS);
  return state;
}

export function timeoutMessage(label: string, verb: string): string {
  return `${label} ${verb} for ${IDLE_TIMEOUT_MS / 1000}s — the request timed out and was cancelled automatically.`;
}

export async function readErrorBody(response: Response): Promise<string> {
  return response.text().catch(() => "");
}

export function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function contentLength(content: ChatMessage["content"]): number {
  if (typeof content === "string") return content.length;
  return content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0);
}

export function logLlmRequest(label: string, model: string | undefined, messages: ChatMessage[]): void {
  const msgs = messages.length;
  const chars = messages.reduce((sum, m) => sum + contentLength(m.content), 0);
  console.log(`[LLM →] ${label}/${model ?? "?"} · ${msgs} msgs · ${chars} chars`);
  if (process.env.LLM_VERBOSE === "1") {
    for (const m of messages) {
      const text =
        typeof m.content === "string"
          ? m.content
          : m.content.map((p) => (p.type === "text" ? p.text : "[image]")).join("");
      console.log(`  [${m.role}] ${text}`);
    }
  }
}

export function logLlmResponse(label: string, model: string | undefined, text: string): void {
  console.log(`[LLM ←] ${label}/${model ?? "?"} · ${text.length} chars`);
  if (process.env.LLM_VERBOSE === "1") {
    console.log(`  [content] ${text}`);
  }
}
