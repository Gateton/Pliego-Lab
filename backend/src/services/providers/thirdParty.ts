// Third-party providers that speak the OpenAI chat-completions wire format. They all share the
// same engine; only the base URL, defaults and the params they accept differ. Adding one is a
// single entry here — no other file in the app needs to change.

import { createOpenAICompatibleProvider } from "./openaiCompatible.js";
import type { ProviderAdapter, ProviderCapabilities, ProviderId } from "./types.js";

// Conservative baseline: only the parameters the OpenAI API itself documents. Providers below
// opt into extra sampler params (top_k/min_p/repetition) where they are known to accept them.
const BASE_PARAMS: ProviderCapabilities["params"] = {
  top_k: false,
  repetition_penalty: false,
  min_p: false,
  frequency_penalty: true,
  presence_penalty: true,
  seed: true,
  n: false,
  transforms: false,
  reasoning: "none",
  verbosity: false,
  maxTokensField: "max_tokens",
};

function caps(
  params: Partial<ProviderCapabilities["params"]> = {},
  top: Partial<Omit<ProviderCapabilities, "params">> = {},
): ProviderCapabilities {
  return {
    chat: true,
    streaming: true,
    modelList: true,
    jsonMode: true,
    ...top,
    params: { ...BASE_PARAMS, ...params },
  };
}

interface ThirdPartyConfig {
  id: ProviderId;
  label: string;
  description: string;
  baseUrl: string;
  defaultModel?: string;
  embeddingModel?: string;
  capabilities?: ProviderCapabilities;
  modelsPath?: string | null;
  chatPath?: string;
  authHeader?: { name: string; prefix: string };
  keyless?: boolean;
}

const THIRD_PARTY: ThirdPartyConfig[] = [
  {
    id: "groq",
    label: "Groq",
    description: "Very fast inference (LPU) on Llama, Mixtral and other open models.",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "DeepSeek models (chat and reasoner) with an OpenAI-compatible API.",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    description: "xAI's Grok models.",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3-mini",
    capabilities: caps({ reasoning: "effort" }),
  },
  {
    id: "mistral",
    label: "Mistral",
    description: "Mistral models and its own embeddings.",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    embeddingModel: "mistral-embed",
    capabilities: caps(),
  },
  {
    id: "perplexity",
    label: "Perplexity",
    description: "Sonar models with built-in web search.",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar",
  },
  {
    id: "together",
    label: "Together AI",
    description: "Large catalog of open models plus embeddings.",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    embeddingModel: "BAAI/bge-large-en-v1.5",
    capabilities: caps({ top_k: true, repetition_penalty: true, min_p: true }),
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    description: "Open models served at high speed.",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    capabilities: caps({ top_k: true }),
  },
  {
    id: "moonshot",
    label: "Moonshot (Kimi)",
    description: "Moonshot AI's Kimi models.",
    baseUrl: "https://api.moonshot.ai/v1",
    defaultModel: "moonshot-v1-8k",
  },
  {
    id: "zai",
    label: "Z.AI (GLM)",
    description: "Zhipu / Z.AI's GLM models.",
    baseUrl: "https://api.z.ai/api/paas/v4",
    defaultModel: "glm-4.6",
    capabilities: caps({ top_k: true, repetition_penalty: true }),
  },
  {
    id: "siliconflow",
    label: "SiliconFlow",
    description: "Open models hosted on SiliconFlow plus embeddings.",
    baseUrl: "https://api.siliconflow.com/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    embeddingModel: "BAAI/bge-m3",
    capabilities: caps({ top_k: true, repetition_penalty: true }),
  },
  {
    id: "nanogpt",
    label: "NanoGPT",
    description: "Pay-as-you-go gateway with many models.",
    baseUrl: "https://nano-gpt.com/api/v1",
  },
  {
    id: "electronhub",
    label: "ElectronHub",
    description: "Gateway with models from several providers.",
    baseUrl: "https://api.electronhub.ai/v1",
  },
  {
    id: "chutes",
    label: "Chutes",
    description: "Decentralized open models (Bittensor).",
    baseUrl: "https://llm.chutes.ai/v1",
  },
  {
    id: "pollinations",
    label: "Pollinations",
    description: "Keyless endpoint for open models.",
    baseUrl: "https://text.pollinations.ai/openai",
    modelsPath: null,
    keyless: true,
    capabilities: caps({}, { modelList: false }),
  },
  {
    id: "aimlapi",
    label: "AI/ML API",
    description: "Gateway with hundreds of models (text, image, audio).",
    baseUrl: "https://api.aimlapi.com/v1",
  },
  {
    id: "cometapi",
    label: "CometAPI",
    description: "Model aggregation gateway.",
    baseUrl: "https://api.cometapi.com/v1",
  },
  {
    id: "ai21",
    label: "AI21 (Jamba)",
    description: "AI21's Jamba models with an OpenAI-compatible endpoint.",
    baseUrl: "https://api.ai21.com/studio/v1",
    defaultModel: "jamba-large-1.7",
  },
  {
    id: "cohere",
    label: "Cohere",
    description: "Command models through its OpenAI compatibility layer.",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    defaultModel: "command-r-plus",
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    description: "OpenAI deployments on Azure. The Base URL must include the deployment (e.g. https://my-resource.openai.azure.com/openai/deployments/my-deploy).",
    baseUrl: "",
    chatPath: "/chat/completions?api-version=2024-10-21",
    authHeader: { name: "api-key", prefix: "" },
    modelsPath: null,
    capabilities: caps({}, { modelList: false }),
  },
];

export function createThirdPartyProviders(): Record<string, ProviderAdapter> {
  const adapters: Record<string, ProviderAdapter> = {};
  for (const cfg of THIRD_PARTY) {
    adapters[cfg.id] = createOpenAICompatibleProvider({
      id: cfg.id,
      label: cfg.label,
      description: cfg.description,
      defaultBaseUrl: cfg.baseUrl,
      defaultModel: cfg.defaultModel ?? "",
      defaultEmbeddingModel: cfg.embeddingModel ?? "",
      capabilities: cfg.capabilities ?? caps(),
      modelsPath: cfg.modelsPath,
      chatPath: cfg.chatPath,
      authHeader: cfg.authHeader,
      requiresApiKey: !cfg.keyless,
    });
  }
  return adapters;
}
