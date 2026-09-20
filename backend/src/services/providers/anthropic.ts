// Anthropic (Claude) adapter. Claude does not speak the OpenAI wire format: it has its own
// `/v1/messages` endpoint, a separate system field, a required `max_tokens`, and SSE events
// (`content_block_delta`, `message_delta`, …) instead of `choices[].delta`. This adapter
// translates both directions so the rest of the app sees the same ChatDelta/NormalizedUsage
// contract as every other provider.

import { ProviderRequestError } from "./types.js";
import type {
  ChatDelta,
  ChatMessage,
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
import { createIdleController, logLlmRequest, logLlmResponse, numOrNull, readErrorBody, timeoutMessage } from "./http.js";

const BASE_URL = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

const CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  modelList: true,
  jsonMode: false,
  params: {
    top_k: true,
    repetition_penalty: false,
    min_p: false,
    frequency_penalty: false,
    presence_penalty: false,
    seed: false,
    n: false,
    transforms: false,
    reasoning: "none",
    verbosity: false,
    maxTokensField: "max_tokens",
  },
};

interface AnthropicMessage {
  role: "user" | "assistant";
  content: unknown[];
}

function toImageBlock(url: string): unknown {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url);
  if (match) return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
  return { type: "image", source: { type: "url", url } };
}

function toBlocks(content: ChatMessage["content"]): unknown[] {
  if (typeof content === "string") return content.trim() ? [{ type: "text", text: content }] : [];
  return content.map((part) => (part.type === "text" ? { type: "text", text: part.text } : toImageBlock(part.image_url.url)));
}

/** Splits the system text out and merges consecutive same-role turns (Claude rejects both). */
function splitConversation(messages: ChatMessage[]): { system: string; conversation: AnthropicMessage[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : toBlocks(m.content).map((b) => (b as { text?: string }).text ?? "").join("")))
    .join("\n\n")
    .trim();

  const conversation: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const blocks = toBlocks(m.content);
    const last = conversation[conversation.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else conversation.push({ role, content: blocks });
  }
  if (conversation.length === 0) {
    conversation.push({ role: "user", content: [{ type: "text", text: system || "Hola." }] });
  } else if (conversation[0].role !== "user") {
    // Claude requires the conversation to open with a user turn; the card's greeting is an
    // assistant turn, so the system text (or a minimal seed) goes in as the opening user message.
    conversation.unshift({ role: "user", content: [{ type: "text", text: system || "Comienza la escena." }] });
  }
  return { system, conversation };
}

function buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
  const { system, conversation } = splitConversation(req.messages);
  const sampling: SamplingParams = req.sampling ?? {};
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? sampling.max_tokens ?? DEFAULT_MAX_TOKENS,
    messages: conversation,
    stream,
  };
  if (system) body.system = system;
  if (sampling.temperature !== undefined) body.temperature = sampling.temperature;
  if (sampling.top_p !== undefined) body.top_p = sampling.top_p;
  if (sampling.top_k !== undefined) body.top_k = sampling.top_k;
  return body;
}

function parseUsage(input: unknown, output: unknown, cached: unknown): NormalizedUsage {
  const inputTokens = numOrNull(input);
  const outputTokens = numOrNull(output);
  return {
    inputTokens,
    outputTokens,
    reasoningTokens: null,
    cachedTokens: numOrNull(cached),
    totalTokens: inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null,
    costUsd: null,
  };
}

function headers(connection: ProviderConnection, base: Record<string, string> = {}): Record<string, string> {
  const result: Record<string, string> = {
    ...base,
    "anthropic-version": API_VERSION,
    ...connection.extraHeaders,
  };
  if (connection.apiKey) result["x-api-key"] = connection.apiKey;
  return result;
}

function apiUrl(connection: ProviderConnection, path: string): string {
  return `${connection.baseUrl.replace(/\/+$/, "")}${path}`;
}

function extractText(content: unknown): { text: string; reasoning: string } {
  const blocks = Array.isArray(content) ? content : [];
  let text = "";
  let reasoning = "";
  for (const raw of blocks) {
    const block = (raw ?? {}) as { type?: string; text?: string; thinking?: string };
    if (block.type === "text" && block.text) text += block.text;
    else if (block.type === "thinking" && block.thinking) reasoning += block.thinking;
  }
  return { text, reasoning };
}

async function completeChat(
  connection: ProviderConnection,
  req: ChatRequest,
  signal: AbortSignal,
): Promise<CompletionResult & GenerationMeta> {
  logLlmRequest("Anthropic", req.model, req.messages);
  const idle = createIdleController(signal);
  const body = buildBody(req, false);
  let response: Response;
  try {
    response = await fetch(apiUrl(connection, "/messages"), {
      method: "POST",
      signal: idle.signal,
      headers: headers(connection, { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (idle.timedOut) throw new ProviderRequestError(timeoutMessage("Anthropic", "did not respond"), 504);
    throw error;
  } finally {
    idle.dispose();
  }
  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    throw new ProviderRequestError(`Anthropic request failed (${response.status}): ${errorBody}`, response.status);
  }
  const data = (await response.json()) as { content?: unknown; usage?: Record<string, unknown> };
  const { text, reasoning } = extractText(data.content);
  const usage = data.usage ?? {};
  logLlmResponse("Anthropic", req.model, text);
  return {
    content: text,
    reasoning,
    usage: parseUsage(usage.input_tokens, usage.output_tokens, usage.cache_read_input_tokens),
    provider: "anthropic",
    model: req.model ?? "",
  };
}

export const anthropicProvider: ProviderAdapter = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  description: "Anthropic's Claude models (the /v1/messages endpoint).",
  requiresApiKey: true,
  defaultBaseUrl: BASE_URL,
  defaultModel: "claude-sonnet-4-5",
  defaultEmbeddingModel: "",
  capabilities: CAPABILITIES,

  async listModels(connection: ProviderConnection): Promise<ModelDescriptor[]> {
    const response = await fetch(apiUrl(connection, "/models?limit=100"), { headers: headers(connection, { Accept: "application/json" }) });
    if (!response.ok) {
      const body = await readErrorBody(response);
      throw new ProviderRequestError(`Anthropic models request failed (${response.status}): ${body}`, response.status);
    }
    const data = (await response.json()) as { data?: Array<{ id?: string; display_name?: string }> };
    return (data.data ?? []).map((m) => ({
      id: String(m.id ?? ""),
      name: m.display_name || String(m.id ?? ""),
      contextLength: null,
      pricing: null,
    }));
  },

  async testConnection(connection: ProviderConnection, model?: string): Promise<{ reply: string }> {
    const { content } = await completeChat(
      connection,
      { messages: [{ role: "user", content: "hi" }], model: model || connection.defaultModel, maxTokens: 16 },
      new AbortController().signal,
    );
    return { reply: content };
  },

  completeChat,

  async *streamChat(connection: ProviderConnection, req: ChatRequest, signal: AbortSignal): AsyncGenerator<ChatDelta, GenerationMeta | undefined> {
    logLlmRequest("Anthropic", req.model, req.messages);
    const idle = createIdleController(signal);
    let response: Response;
    try {
      response = await fetch(apiUrl(connection, "/messages"), {
        method: "POST",
        signal: idle.signal,
        headers: headers(connection, { "Content-Type": "application/json" }),
        body: JSON.stringify(buildBody(req, true)),
      });
    } catch (error) {
      idle.dispose();
      if (idle.timedOut) throw new ProviderRequestError(timeoutMessage("Anthropic", "did not respond"), 504);
      throw error;
    }
    if (!response.ok || !response.body) {
      idle.dispose();
      const errorBody = await readErrorBody(response);
      throw new ProviderRequestError(`Anthropic request failed (${response.status}): ${errorBody}`, response.status);
    }
    idle.bump();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let cachedTokens: number | null = null;

    try {
      while (true) {
        let done: boolean, value: Uint8Array | undefined;
        try {
          ({ done, value } = await reader.read());
        } catch (error) {
          if (idle.timedOut) throw new ProviderRequestError(timeoutMessage("Anthropic", "stopped responding"), 504);
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
          const payload = trimmed.slice("data:".length).trim();
          if (!payload) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(payload) as Record<string, unknown>;
          } catch {
            continue;
          }
          const type = event.type as string | undefined;
          if (type === "message_start") {
            const usage = ((event.message as { usage?: Record<string, unknown> })?.usage ?? {}) as Record<string, unknown>;
            inputTokens = numOrNull(usage.input_tokens);
            cachedTokens = numOrNull(usage.cache_read_input_tokens);
          } else if (type === "content_block_delta") {
            const delta = (event.delta ?? {}) as { type?: string; text?: string; thinking?: string };
            if (delta.type === "thinking_delta" && delta.thinking) yield { type: "reasoning", text: delta.thinking };
            else if (delta.text) {
              accumulated += delta.text;
              yield { type: "content", text: delta.text };
            }
          } else if (type === "message_delta") {
            const usage = (event.usage ?? {}) as Record<string, unknown>;
            outputTokens = numOrNull(usage.output_tokens) ?? outputTokens;
          } else if (type === "error") {
            const message = ((event.error as { message?: string })?.message) ?? "Anthropic stream error";
            throw new ProviderRequestError(`Anthropic: ${message}`, 502);
          }
        }
      }
      if (inputTokens === null && outputTokens === null) return undefined;
      return { provider: "anthropic", model: req.model ?? "", usage: parseUsage(inputTokens, outputTokens, cachedTokens) };
    } finally {
      idle.dispose();
      logLlmResponse("Anthropic", req.model, accumulated);
    }
  },
};
