// OpenRouter adapter: OpenAI-compatible wire format plus OpenRouter's own extras — attribution
// headers, middle-out transforms, its `reasoning` object, `verbosity`, and a `/models` payload
// that carries context length and per-token pricing (used by the Usage dashboard).

import { config } from "../../config.js";
import { createOpenAICompatibleProvider } from "./openaiCompatible.js";
import type { ModelDescriptor, ProviderCapabilities } from "./types.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  modelList: true,
  jsonMode: true,
  params: {
    top_k: true,
    repetition_penalty: true,
    min_p: true,
    frequency_penalty: true,
    presence_penalty: true,
    seed: true,
    n: true,
    transforms: true,
    reasoning: "object",
    verbosity: true,
    maxTokensField: "max_tokens",
  },
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseOpenRouterModels(data: unknown): ModelDescriptor[] {
  const list = Array.isArray((data as { data?: unknown })?.data) ? (data as { data: unknown[] }).data : [];
  return list.map((raw) => {
    const m = (raw ?? {}) as Record<string, unknown>;
    const pricing = (m.pricing ?? {}) as Record<string, unknown>;
    const prompt = toNumber(pricing.prompt);
    const completion = toNumber(pricing.completion);
    return {
      id: String(m.id ?? ""),
      name: typeof m.name === "string" ? m.name : String(m.id ?? ""),
      contextLength: typeof m.context_length === "number" ? m.context_length : null,
      pricing: { prompt, completion },
    };
  });
}

export const openRouterProvider = createOpenAICompatibleProvider({
  id: "openrouter",
  label: "OpenRouter",
  description: "Multi-provider with free models, per-token pricing and real cost reporting.",
  defaultBaseUrl: OPENROUTER_BASE_URL,
  defaultModel: config.defaultModel,
  defaultEmbeddingModel: config.defaultEmbeddingModel,
  capabilities: CAPABILITIES,
  // Ask OpenRouter to include its cost accounting inside `usage` so the app can report a real
  // USD figure instead of estimating one.
  augmentBody: (body) => {
    body.usage = { include: true };
  },
  parseModels: (_conn, data) => parseOpenRouterModels(data),
  usageIncludesCost: true,
});
