import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Pliego Lab is a local, single-user application. Only opt into another
  // bind address explicitly when running behind a deliberately configured
  // security boundary.
  host: process.env.HOST?.trim() || "127.0.0.1",
  // Optional now that other providers exist — each provider resolves its own key at request time
  // (see services/providers/resolve.ts). Kept as the OpenRouter fallback for headless setups.
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? null,
  defaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-4o-mini",
  defaultEmbeddingModel: process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
};
