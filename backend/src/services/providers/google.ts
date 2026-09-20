// Google Gemini adapter (AI Studio / Generative Language API). The wire format is completely
// different from OpenAI: `contents` with `parts`, a separate `systemInstruction`, and
// `:generateContent` / `:streamGenerateContent` methods with the key in the query string. This
// adapter normalizes both directions to the shared ChatDelta/NormalizedUsage contract.

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

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  modelList: true,
  jsonMode: true,
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

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function toParts(content: ChatMessage["content"]): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  return content.flatMap((part): GeminiPart[] => {
    if (part.type === "text") return [{ text: part.text }];
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(part.image_url.url);
    return match ? [{ inlineData: { mimeType: match[1], data: match[2] } }] : [];
  });
}

function buildContents(messages: ChatMessage[]): { systemInstruction: { parts: GeminiPart[] } | undefined; contents: GeminiContent[] } {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : toParts(m.content).map((p) => p.text ?? "").join("")))
    .join("\n\n")
    .trim();

  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const parts = toParts(m.content);
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }
  // Gemini tolerates any starting role, but an empty conversation is invalid.
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: systemText || "Hola." }] });
  return { systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined, contents };
}

function buildBody(req: ChatRequest): Record<string, unknown> {
  const sampling: SamplingParams = req.sampling ?? {};
  const generationConfig: Record<string, unknown> = {};
  if (sampling.temperature !== undefined) generationConfig.temperature = sampling.temperature;
  if (sampling.top_p !== undefined) generationConfig.topP = sampling.top_p;
  if (sampling.top_k !== undefined) generationConfig.topK = sampling.top_k;
  const maxTokens = req.maxTokens ?? sampling.max_tokens;
  if (maxTokens !== undefined) generationConfig.maxOutputTokens = maxTokens;
  if (req.json) generationConfig.responseMimeType = "application/json";

  const { systemInstruction, contents } = buildContents(req.messages);
  return {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

function parseUsage(meta: Record<string, unknown>): NormalizedUsage {
  const inputTokens = numOrNull(meta.promptTokenCount);
  const outputTokens = numOrNull(meta.candidatesTokenCount);
  const totalTokens = numOrNull(meta.totalTokenCount);
  return {
    inputTokens,
    outputTokens,
    reasoningTokens: numOrNull(meta.thoughtsTokenCount),
    cachedTokens: numOrNull(meta.cachedContentTokenCount),
    totalTokens: totalTokens ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
    costUsd: null,
  };
}

function endpoint(connection: ProviderConnection, model: string, method: string, extraQuery = ""): string {
  const key = connection.apiKey ? `key=${encodeURIComponent(connection.apiKey)}` : "";
  const query = [extraQuery, key].filter(Boolean).join("&");
  return `${connection.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:${method}${query ? `?${query}` : ""}`;
}

function listUrl(connection: ProviderConnection): string {
  const key = connection.apiKey ? `?key=${encodeURIComponent(connection.apiKey)}` : "";
  return `${connection.baseUrl.replace(/\/+$/, "")}/models${key}`;
}

function extractText(candidate: unknown): string {
  const parts = ((candidate as { content?: { parts?: GeminiPart[] } })?.content?.parts ?? []) as GeminiPart[];
  return parts.map((p) => p.text ?? "").join("");
}

function blockedReason(data: Record<string, unknown>): string | null {
  const feedback = data.promptFeedback as { blockReason?: string } | undefined;
  if (feedback?.blockReason) return `blocked (${feedback.blockReason})`;
  const candidates = (data.candidates ?? []) as Array<{ finishReason?: string }>;
  if (candidates.length === 0) return "no candidates in the response";
  return null;
}

async function completeChat(
  connection: ProviderConnection,
  req: ChatRequest,
  signal: AbortSignal,
): Promise<CompletionResult & GenerationMeta> {
  const model = req.model || connection.defaultModel;
  logLlmRequest("Google", model, req.messages);
  const idle = createIdleController(signal);
  let response: Response;
  try {
    response = await fetch(endpoint(connection, model, "generateContent"), {
      method: "POST",
      signal: idle.signal,
      headers: { "Content-Type": "application/json", ...connection.extraHeaders },
      body: JSON.stringify(buildBody(req)),
    });
  } catch (error) {
    if (idle.timedOut) throw new ProviderRequestError(timeoutMessage("Google", "did not respond"), 504);
    throw error;
  } finally {
    idle.dispose();
  }
  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    throw new ProviderRequestError(`Google request failed (${response.status}): ${errorBody}`, response.status);
  }
  const data = (await response.json()) as Record<string, unknown>;
  const text = extractText(((data.candidates ?? []) as unknown[])[0]);
  const reason = blockedReason(data);
  if (!text && reason) throw new ProviderRequestError(`Google returned no text: ${reason}`, 502);
  logLlmResponse("Google", model, text);
  return {
    content: text,
    reasoning: "",
    usage: parseUsage((data.usageMetadata ?? {}) as Record<string, unknown>),
    provider: "google",
    model,
  };
}

export const googleProvider: ProviderAdapter = {
  id: "google",
  label: "Google Gemini",
  description: "Gemini models through AI Studio, with its own embeddings.",
  requiresApiKey: true,
  defaultBaseUrl: BASE_URL,
  defaultModel: "gemini-2.0-flash",
  defaultEmbeddingModel: "text-embedding-004",
  capabilities: CAPABILITIES,

  async listModels(connection: ProviderConnection): Promise<ModelDescriptor[]> {
    const response = await fetch(listUrl(connection), { headers: { Accept: "application/json", ...connection.extraHeaders } });
    if (!response.ok) {
      const body = await readErrorBody(response);
      throw new ProviderRequestError(`Google models request failed (${response.status}): ${body}`, response.status);
    }
    const data = (await response.json()) as { models?: Array<{ name?: string; displayName?: string; inputTokenLimit?: number }> };
    return (data.models ?? []).map((m) => {
      const id = String(m.name ?? "").replace(/^models\//, "");
      return { id, name: m.displayName || id, contextLength: m.inputTokenLimit ?? null, pricing: null };
    });
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
    const model = req.model || connection.defaultModel;
    logLlmRequest("Google", model, req.messages);
    const idle = createIdleController(signal);
    let response: Response;
    try {
      response = await fetch(endpoint(connection, model, "streamGenerateContent", "alt=sse"), {
        method: "POST",
        signal: idle.signal,
        headers: { "Content-Type": "application/json", ...connection.extraHeaders },
        body: JSON.stringify(buildBody(req)),
      });
    } catch (error) {
      idle.dispose();
      if (idle.timedOut) throw new ProviderRequestError(timeoutMessage("Google", "did not respond"), 504);
      throw error;
    }
    if (!response.ok || !response.body) {
      idle.dispose();
      const errorBody = await readErrorBody(response);
      throw new ProviderRequestError(`Google request failed (${response.status}): ${errorBody}`, response.status);
    }
    idle.bump();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let usage: NormalizedUsage | undefined;

    try {
      while (true) {
        let done: boolean, value: Uint8Array | undefined;
        try {
          ({ done, value } = await reader.read());
        } catch (error) {
          if (idle.timedOut) throw new ProviderRequestError(timeoutMessage("Google", "stopped responding"), 504);
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
          if (event.usageMetadata) usage = parseUsage(event.usageMetadata as Record<string, unknown>);
          const chunk = extractText(((event.candidates ?? []) as unknown[])[0]);
          if (chunk) {
            accumulated += chunk;
            yield { type: "content", text: chunk };
          }
        }
      }
      return usage ? { provider: "google", model, usage } : undefined;
    } finally {
      idle.dispose();
      logLlmResponse("Google", model, accumulated);
    }
  },
};
