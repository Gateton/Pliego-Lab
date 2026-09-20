// OpenAI adapter: same wire format as OpenRouter but with OpenAI's own conventions — the
// `max_completion_tokens` field, top-level `reasoning_effort`, no middle-out transforms, and a
// `/models` payload without pricing. Kept as a distinct adapter (rather than a generic custom
// endpoint) so capabilities and defaults are correct out of the box.

import { createOpenAICompatibleProvider } from "./openaiCompatible.js";
import type { ProviderCapabilities } from "./types.js";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

const CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  modelList: true,
  jsonMode: true,
  params: {
    top_k: false,
    repetition_penalty: false,
    min_p: false,
    frequency_penalty: true,
    presence_penalty: true,
    seed: true,
    n: false,
    transforms: false,
    reasoning: "effort",
    verbosity: false,
    maxTokensField: "max_completion_tokens",
  },
};

export const openAIProvider = createOpenAICompatibleProvider({
  id: "openai",
  label: "OpenAI",
  description: "OpenAI's official API (GPT). Uses max_completion_tokens and reasoning_effort.",
  defaultBaseUrl: OPENAI_BASE_URL,
  defaultModel: "gpt-4o-mini",
  defaultEmbeddingModel: "text-embedding-3-small",
  capabilities: CAPABILITIES,
});
