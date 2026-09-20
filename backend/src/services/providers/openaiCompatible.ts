// Core engine behind every provider. OpenRouter, OpenAI and any custom "OpenAI-compatible"
// endpoint all speak the same chat-completions wire format, so they share this implementation —
// an adapter only declares its capabilities, its defaults, and a few small hooks. This is where
// the API key is attached, sampling is filtered down to what the provider supports, SSE is
// parsed and usage is normalized; nothing above this file knows the provider's URL or key.

import { EMPTY_USAGE, ProviderRequestError } from "./types.js";
import type {
  ChatDelta,
  ChatRequest,
  CompletionResult,
  GenerationMeta,
  ModelDescriptor,
  NormalizedUsage,
  ProviderAdapter,
  ProviderCapabilities,
  ProviderConnection,
  SamplingParams,
} from "./types.js";
import {
  createIdleController,
  IDLE_TIMEOUT_MS,
  logLlmRequest,
  logLlmResponse,
  numOrNull,
  readErrorBody,
  timeoutMessage,
} from "./http.js";

/** Normalizes every provider's `usage` block into one shape. Missing fields stay null. */
function parseUsage(raw: unknown, includeCost: boolean): NormalizedUsage {
  if (!raw || typeof raw !== "object") return { ...EMPTY_USAGE };
  const u = raw as Record<string, unknown>;
  const completionDetails = (u.completion_tokens_details ?? {}) as Record<string, unknown>;
  const promptDetails = (u.prompt_tokens_details ?? {}) as Record<string, unknown>;
  return {
    inputTokens: numOrNull(u.prompt_tokens),
    outputTokens: numOrNull(u.completion_tokens),
    reasoningTokens: numOrNull(completionDetails.reasoning_tokens),
    cachedTokens: numOrNull(promptDetails.cached_tokens),
    totalTokens: numOrNull(u.total_tokens),
    costUsd: includeCost ? numOrNull(u.cost) : null,
  };
}

/**
 * Turns the app-wide SamplingParams into the provider's request body, dropping anything the
 * provider does not declare support for and translating reasoning/verbosity into the shape the
 * provider expects. `maxTokens` (a hard per-call cap) always wins over `sampling.max_tokens`.
 */
function buildRequestBody(
  conn: ProviderConnection,
  req: ChatRequest,
  augment?: (body: Record<string, unknown>, req: ChatRequest) => void,
): Record<string, unknown> {
  const caps = conn.capabilities.params;
  const sampling: SamplingParams = req.sampling ?? {};
  const body: Record<string, unknown> = {
    model: req.model || conn.defaultModel,
    messages: req.messages,
    stream: false,
  };

  if (sampling.temperature !== undefined) body.temperature = sampling.temperature;
  if (sampling.top_p !== undefined) body.top_p = sampling.top_p;
  if (caps.top_k && sampling.top_k !== undefined) body.top_k = sampling.top_k;
  if (caps.repetition_penalty && sampling.repetition_penalty !== undefined) body.repetition_penalty = sampling.repetition_penalty;
  if (caps.frequency_penalty && sampling.frequency_penalty !== undefined) body.frequency_penalty = sampling.frequency_penalty;
  if (caps.presence_penalty && sampling.presence_penalty !== undefined) body.presence_penalty = sampling.presence_penalty;
  if (caps.min_p && sampling.min_p !== undefined) body.min_p = sampling.min_p;
  if (caps.seed && sampling.seed !== undefined && sampling.seed >= 0) body.seed = sampling.seed;
  if (caps.n && sampling.n !== undefined) body.n = sampling.n;
  if (caps.transforms && sampling.transforms !== undefined) body.transforms = sampling.transforms;

  const maxTokens = req.maxTokens ?? sampling.max_tokens;
  if (maxTokens !== undefined) body[caps.maxTokensField] = maxTokens;

  // Reasoning: OpenRouter takes a `reasoning` object, OpenAI takes a top-level `reasoning_effort`,
  // and providers that support neither get the field silently dropped.
  if (sampling.reasoning) {
    if (caps.reasoning === "object") {
      body.reasoning = sampling.reasoning;
    } else if (caps.reasoning === "effort") {
      if (sampling.reasoning.enabled !== false && sampling.reasoning.effort && sampling.reasoning.effort !== "auto") {
        body.reasoning_effort = sampling.reasoning.effort;
      }
    }
  }

  if (caps.verbosity && sampling.verbosity && sampling.verbosity !== "auto") body.verbosity = sampling.verbosity;

  if (req.json && conn.capabilities.jsonMode) body.response_format = { type: "json_object" };
  else if (sampling.response_format) body.response_format = sampling.response_format;

  augment?.(body, req);
  return body;
}

/** Generic `/models` reader: `{ data: [{ id, name?, context_length? }] }`, pricing unknown. */
export function parseGenericModels(data: unknown): ModelDescriptor[] {
  const list = Array.isArray((data as { data?: unknown })?.data) ? ((data as { data: unknown[] }).data) : [];
  return list.map((raw) => {
    const m = (raw ?? {}) as Record<string, unknown>;
    return {
      id: String(m.id ?? ""),
      name: typeof m.name === "string" ? m.name : String(m.id ?? ""),
      contextLength: typeof m.context_length === "number" ? m.context_length : null,
      pricing: null,
    };
  });
}

export interface OpenAICompatibleOptions {
  id: ProviderAdapter["id"];
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  defaultEmbeddingModel: string;
  capabilities: ProviderCapabilities;
  /** Defaults to true; set false for keyless endpoints. */
  requiresApiKey?: boolean;
  /** Provider-specific additions to the request body (e.g. OpenRouter usage/cost opt-in). */
  augmentBody?: (body: Record<string, unknown>, req: ChatRequest) => void;
  /** Provider-specific reading of the `/models` payload (pricing, context length, ...). */
  parseModels?: (conn: ProviderConnection, data: unknown) => ModelDescriptor[];
  /** Whether the provider reports a real USD cost inside `usage`. */
  usageIncludesCost?: boolean;
  /** Auth header style; defaults to `Authorization: Bearer <key>` (e.g. Azure uses `api-key`). */
  authHeader?: { name: string; prefix: string };
  /** Path relative to baseUrl for each endpoint. `null` disables that endpoint entirely. */
  chatPath?: string;
  modelsPath?: string | null;
  /** Whether to send `stream_options.include_usage` on streaming requests. */
  streamUsage?: boolean;
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleOptions): ProviderAdapter {
  const capabilities = options.capabilities;
  const usageIncludesCost = options.usageIncludesCost ?? false;
  const authHeader = options.authHeader ?? { name: "Authorization", prefix: "Bearer " };
  const chatPath = options.chatPath ?? "/chat/completions";
  const modelsPath = options.modelsPath === undefined ? "/models" : options.modelsPath;
  const includeStreamUsage = options.streamUsage ?? true;

  function buildHeaders(conn: ProviderConnection, base: Record<string, string> = {}): Record<string, string> {
    const headers = { ...base, ...conn.extraHeaders };
    if (conn.apiKey) headers[authHeader.name] = `${authHeader.prefix}${conn.apiKey}`;
    return headers;
  }

  async function fetchCompletion(
    conn: ProviderConnection,
    req: ChatRequest,
    signal: AbortSignal,
    opts: { maxTokens?: number },
  ): Promise<{ data: Record<string, unknown>; usage: NormalizedUsage }> {
    const idle = createIdleController(signal);
    let response: Response;
    const body = buildRequestBody(conn, { ...req, maxTokens: opts.maxTokens ?? req.maxTokens }, options.augmentBody);
    logLlmRequest(options.label, body.model as string, req.messages);
    try {
      response = await fetch(`${conn.baseUrl}${chatPath}`, {
        method: "POST",
        signal: idle.signal,
        headers: buildHeaders(conn, { "Content-Type": "application/json" }),
        body: JSON.stringify({ ...body, stream: false }),
      });
    } catch (error) {
      if (idle.timedOut) throw new ProviderRequestError(timeoutMessage(options.label, "did not respond"), 504);
      throw error;
    } finally {
      idle.dispose();
    }

    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      console.error(`[${conn.label}] ${body.model as string} request failed (${response.status}): ${errorBody}`);
      throw new ProviderRequestError(`${conn.label} request failed (${response.status}): ${errorBody}`, response.status);
    }
    const data = (await response.json()) as Record<string, unknown>;
    return { data, usage: parseUsage(data.usage, usageIncludesCost) };
  }

  return {
    id: options.id,
    label: options.label,
    description: options.description,
    requiresApiKey: options.requiresApiKey ?? true,
    defaultBaseUrl: options.defaultBaseUrl,
    defaultModel: options.defaultModel,
    defaultEmbeddingModel: options.defaultEmbeddingModel,
    capabilities,

    async listModels(conn: ProviderConnection): Promise<ModelDescriptor[]> {
      if (!capabilities.modelList || modelsPath === null) return [];
      const response = await fetch(`${conn.baseUrl}${modelsPath}`, {
        headers: buildHeaders(conn, { Accept: "application/json" }),
      });
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new ProviderRequestError(`${conn.label} models request failed (${response.status}): ${body}`, response.status);
      }
      const data = (await response.json()) as unknown;
      return options.parseModels ? options.parseModels(conn, data) : parseGenericModels(data);
    },

    async testConnection(conn: ProviderConnection, model?: string): Promise<{ reply: string }> {
      const { data } = await fetchCompletion(
        conn,
        {
          messages: [{ role: "user", content: "hi" }],
          model: model ?? conn.defaultModel,
        },
        new AbortController().signal,
        { maxTokens: 5 },
      );
      const choices = (data.choices ?? []) as Array<{ message?: { content?: string } }>;
      return { reply: choices[0]?.message?.content ?? "" };
    },

    async completeChat(conn, req, signal): Promise<CompletionResult & GenerationMeta> {
      const { data, usage } = await fetchCompletion(conn, req, signal, {});
      const model = (req.model || conn.defaultModel) as string;
      const message = ((data.choices ?? []) as Array<{ message?: { content?: string; reasoning?: string; reasoning_content?: string } }>)[0]?.message;
      const content = message?.content ?? "";
      logLlmResponse(options.label, model, content);
      return {
        content,
        reasoning: message?.reasoning ?? message?.reasoning_content ?? "",
        usage,
        provider: options.id,
        model,
      };
    },

    async *streamChat(conn, req, signal): AsyncGenerator<ChatDelta, GenerationMeta | undefined> {
      const idle = createIdleController(signal);
      const body = buildRequestBody(conn, req, options.augmentBody);
      logLlmRequest(options.label, body.model as string, req.messages);
      let response: Response;
      try {
        response = await fetch(`${conn.baseUrl}${chatPath}`, {
          method: "POST",
          signal: idle.signal,
          headers: buildHeaders(conn, { "Content-Type": "application/json" }),
          body: JSON.stringify({ ...body, stream: true, ...(includeStreamUsage ? { stream_options: { include_usage: true } } : {}) }),
        });
      } catch (error) {
        idle.dispose();
        if (idle.timedOut) throw new ProviderRequestError(timeoutMessage(options.label, "did not respond"), 504);
        throw error;
      }

      if (!response.ok || !response.body) {
        idle.dispose();
        const errorBody = await readErrorBody(response);
        console.error(`[${conn.label}] ${body.model as string} stream request failed (${response.status}): ${errorBody}`);
        throw new ProviderRequestError(`${conn.label} request failed (${response.status}): ${errorBody}`, response.status);
      }
      idle.bump();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let usage: NormalizedUsage | undefined;
      const model = body.model as string;

      try {
        while (true) {
          let done: boolean, value: Uint8Array | undefined;
          try {
            ({ done, value } = await reader.read());
          } catch (error) {
            if (idle.timedOut) throw new ProviderRequestError(timeoutMessage(options.label, "stopped responding"), 504);
            throw error;
          }
          idle.bump();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const data = trimmed.slice("data:".length).trim();
            if (data === "[DONE]") {
              return usage ? { provider: options.id, model, usage } : undefined;
            }

            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              if (parsed.usage) usage = parseUsage(parsed.usage, usageIncludesCost);
              const choices = (parsed.choices ?? []) as Array<{
                delta?: { content?: string; reasoning?: string; reasoning_content?: string };
              }>;
              const delta = choices[0]?.delta;
              const reasoningDelta = delta?.reasoning ?? delta?.reasoning_content;
              const contentDelta = delta?.content;
              if (reasoningDelta) yield { type: "reasoning", text: reasoningDelta };
              if (contentDelta) {
                accumulated += contentDelta;
                yield { type: "content", text: contentDelta };
              }
            } catch {
              // Ignore malformed/partial SSE lines rather than aborting the whole stream.
            }
          }
        }
        return usage ? { provider: options.id, model, usage } : undefined;
      } finally {
        idle.dispose();
        logLlmResponse(options.label, model, accumulated);
      }
    },
  };
}
