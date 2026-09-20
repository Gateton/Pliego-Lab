// Provider registry. Adding a new provider means writing one adapter (or one entry in
// thirdParty.ts) and registering it here — nothing else in the app (routes, pipelines, UI)
// changes. Listing every key explicitly keeps the record complete at compile time.

import { anthropicProvider } from "./anthropic.js";
import { createOpenAICompatibleProvider } from "./openaiCompatible.js";
import { googleProvider } from "./google.js";
import { openAIProvider } from "./openai.js";
import { openRouterProvider } from "./openrouter.js";
import { createThirdPartyProviders } from "./thirdParty.js";
import type { ProviderAdapter, ProviderCapabilities, ProviderId } from "./types.js";

// A generic OpenAI-compatible endpoint (llama.cpp, vLLM, LM Studio, ...). The base URL is
// configured by the user, so there is no sensible default model. Capabilities cover the
// OpenAI-compatible contract plus the sampler params local servers commonly accept; reasoning is
// left off because there is no way to know how (or whether) an arbitrary server expects it.
const CUSTOM_CAPABILITIES: ProviderCapabilities = {
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
    n: false,
    transforms: false,
    reasoning: "none",
    verbosity: false,
    maxTokensField: "max_tokens",
  },
};

export const customProvider = createOpenAICompatibleProvider({
  id: "openai-compatible",
  label: "OpenAI-compatible (custom)",
  description: "Any server compatible with the OpenAI API. Set the Base URL (and the API key if it needs one).",
  defaultBaseUrl: "http://127.0.0.1:8080/v1",
  defaultModel: "",
  defaultEmbeddingModel: "",
  capabilities: CUSTOM_CAPABILITIES,
  requiresApiKey: false,
});

const third = createThirdPartyProviders();

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  openrouter: openRouterProvider,
  openai: openAIProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  "openai-compatible": customProvider,
  groq: third.groq,
  deepseek: third.deepseek,
  xai: third.xai,
  mistral: third.mistral,
  perplexity: third.perplexity,
  together: third.together,
  fireworks: third.fireworks,
  moonshot: third.moonshot,
  zai: third.zai,
  siliconflow: third.siliconflow,
  nanogpt: third.nanogpt,
  electronhub: third.electronhub,
  chutes: third.chutes,
  pollinations: third.pollinations,
  aimlapi: third.aimlapi,
  cometapi: third.cometapi,
  ai21: third.ai21,
  cohere: third.cohere,
  "azure-openai": third["azure-openai"],
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && value in PROVIDERS;
}

export function getAdapter(id: ProviderId): ProviderAdapter {
  return PROVIDERS[id];
}
