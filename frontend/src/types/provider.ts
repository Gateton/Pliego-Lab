/**
 * Providers are defined by the backend registry, so the frontend treats the id as an opaque
 * string rather than duplicating (and drifting from) the server's union.
 */
export type ProviderId = string;

/** Which request knobs a provider accepts — mirrors the backend capabilities shape. */
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
    transforms: boolean;
    reasoning: "object" | "effort" | "none";
    verbosity: boolean;
    maxTokensField: "max_tokens" | "max_completion_tokens";
  };
}

export interface ModelPricing {
  prompt: number;
  completion: number;
}

export interface ModelDescriptor {
  id: string;
  name: string;
  contextLength: number | null;
  /** null when the provider does not publish pricing (OpenAI, custom endpoints). */
  pricing: ModelPricing | null;
}

export interface ProviderSummary {
  id: ProviderId;
  label: string;
  description: string;
  requiresApiKey: boolean;
  active: boolean;
  baseUrl: string;
  defaultBaseUrl: string;
  defaultModel: string;
  defaultEmbeddingModel: string;
  capabilities: ProviderCapabilities;
  hasKey: boolean;
  keyHint: string | null;
  keyFromEnv: boolean;
}
