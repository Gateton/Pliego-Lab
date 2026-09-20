// Shared types for the multi-provider LLM layer. Every adapter speaks the same
// request/response contract in this file, so callers (the main chat pipeline, Image Director,
// Recast, NPC tracker, memory, ...) never need to know which provider is behind it.

export type ProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "xai"
  | "mistral"
  | "perplexity"
  | "together"
  | "fireworks"
  | "moonshot"
  | "zai"
  | "siliconflow"
  | "nanogpt"
  | "electronhub"
  | "chutes"
  | "pollinations"
  | "aimlapi"
  | "cometapi"
  | "ai21"
  | "cohere"
  | "azure-openai"
  | "openai-compatible";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/**
 * Sampling parameters as the app understands them — the union of everything any provider
 * could accept. Adapters filter this down to what their provider actually supports (see
 * ProviderCapabilities), so an unsupported field is dropped instead of being sent blindly.
 */
export interface SamplingParams {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  min_p?: number;
  seed?: number;
  n?: number;
  transforms?: string[];
  reasoning?: { effort?: "auto" | "low" | "medium" | "high"; exclude?: boolean; enabled?: boolean };
  verbosity?: "auto" | "low" | "medium" | "high";
  response_format?: { type: "json_object" };
}

/**
 * Provider-agnostic token/cost accounting. Every field is nullable on purpose: when a provider
 * does not report a value we keep `null` rather than guessing a number, and the UI renders "—".
 * `costUsd` is only ever filled from a real provider-reported cost, never estimated here.
 */
export interface NormalizedUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
}

export const EMPTY_USAGE: NormalizedUsage = {
  inputTokens: null,
  outputTokens: null,
  reasoningTokens: null,
  cachedTokens: null,
  totalTokens: null,
  costUsd: null,
};

/** Which request knobs a provider accepts. Drives both the request transform and the preset UI. */
export interface ProviderCapabilities {
  chat: boolean;
  streaming: boolean;
  modelList: boolean;
  jsonMode: boolean;
  params: {
    top_k: boolean;
    repetition_penalty: boolean;
    min_p: boolean;
    frequency_penalty: boolean;
    presence_penalty: boolean;
    seed: boolean;
    n: boolean;
    /** OpenRouter's "middle-out" context compression. */
    transforms: boolean;
    /** How reasoning is expressed in the request body (or not at all). */
    reasoning: "object" | "effort" | "none";
    verbosity: boolean;
    /** OpenAI renamed `max_tokens` to `max_completion_tokens` on newer models. */
    maxTokensField: "max_tokens" | "max_completion_tokens";
  };
}

/** A fully resolved, ready-to-call provider: identity + endpoint + credentials + capabilities. */
export interface ProviderConnection {
  id: ProviderId;
  label: string;
  requiresApiKey: boolean;
  baseUrl: string;
  apiKey: string | null;
  extraHeaders: Record<string, string>;
  capabilities: ProviderCapabilities;
  defaultModel: string;
  defaultEmbeddingModel: string;
}

export interface ModelPricing {
  /** USD per prompt token. */
  prompt: number;
  /** USD per completion token. */
  completion: number;
}

export interface ModelDescriptor {
  id: string;
  name: string;
  contextLength: number | null;
  /** Present only when the provider publishes pricing (OpenRouter). Otherwise null. */
  pricing: ModelPricing | null;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  sampling?: SamplingParams;
  /** Request JSON output mode. Silently unavailable on providers without jsonMode. */
  json?: boolean;
  /** Hard cap for a single call, layered on top of `sampling.max_tokens`. */
  maxTokens?: number;
}

export interface ChatDelta {
  type: "reasoning" | "content";
  text: string;
}

export interface CompletionResult {
  content: string;
  reasoning: string;
  usage: NormalizedUsage;
}

/** Metadata returned alongside every completed generation so callers can record real usage. */
export interface GenerationMeta {
  provider: ProviderId;
  model: string;
  usage: NormalizedUsage;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** One-line description shown in the provider picker. */
  description: string;
  /** False for keyless endpoints (local/custom servers, Pollinations). */
  requiresApiKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  defaultEmbeddingModel: string;
  capabilities: ProviderCapabilities;
  listModels(conn: ProviderConnection): Promise<ModelDescriptor[]>;
  testConnection(conn: ProviderConnection, model?: string): Promise<{ reply: string }>;
  streamChat(
    conn: ProviderConnection,
    req: ChatRequest,
    signal: AbortSignal,
  ): AsyncGenerator<ChatDelta, GenerationMeta | undefined>;
  completeChat(conn: ProviderConnection, req: ChatRequest, signal: AbortSignal): Promise<CompletionResult & GenerationMeta>;
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
