// Provider-agnostic entry point every pipeline in the app talks to. Callers pass messages and
// generation options; this module resolves the active provider (or an explicit one), attaches
// credentials and normalizes the response — so no caller needs to know which vendor is behind it.

import { getActiveProvider, getProviderConnection, requireUsableConnection } from "./providers/resolve.js";
import { getAdapter } from "./providers/registry.js";
import type {
  ChatDelta,
  ChatMessage,
  ChatRequest,
  CompletionResult,
  GenerationMeta,
  ModelDescriptor,
  NormalizedUsage,
  ProviderId,
  SamplingParams,
} from "./providers/types.js";

export type { ChatDelta, ChatMessage, ChatRequest, GenerationMeta, ModelDescriptor, NormalizedUsage, ProviderId, SamplingParams };
export { ProviderRequestError } from "./providers/types.js";

export function completeChat(
  req: ChatRequest,
  signal: AbortSignal,
  providerId?: ProviderId,
): Promise<CompletionResult & GenerationMeta> {
  if (providerId) {
    return getProviderConnection(providerId).then((connection) => {
      requireUsableConnection(connection);
      return getAdapter(providerId).completeChat(connection, req, signal);
    });
  }
  return getActiveProvider().then(({ connection, adapter }) => {
    requireUsableConnection(connection);
    return adapter.completeChat(connection, req, signal);
  });
}

/** Non-streaming chat in JSON output mode. Providers without JSON mode just ignore the hint. */
export async function completeJson(
  req: ChatRequest,
  signal: AbortSignal,
  providerId?: ProviderId,
): Promise<{ content: string } & GenerationMeta> {
  const result = await completeChat({ ...req, json: true }, signal, providerId);
  return { content: result.content, provider: result.provider, model: result.model, usage: result.usage };
}

/**
 * Streams a completion, yielding reasoning/content deltas and returning the generation metadata
 * (provider, model, normalized usage) when the stream ends cleanly.
 */
export async function* streamChat(
  req: ChatRequest,
  signal: AbortSignal,
  providerId?: ProviderId,
): AsyncGenerator<ChatDelta, GenerationMeta | undefined> {
  const { connection, adapter } = providerId
    ? { connection: await getProviderConnection(providerId), adapter: getAdapter(providerId) }
    : await getActiveProvider();
  requireUsableConnection(connection);
  return yield* adapter.streamChat(connection, req, signal);
}

export async function listModels(providerId?: ProviderId): Promise<ModelDescriptor[]> {
  const { connection, adapter } = providerId
    ? { connection: await getProviderConnection(providerId), adapter: getAdapter(providerId) }
    : await getActiveProvider();
  return adapter.listModels(connection);
}

export async function testConnection(providerId?: ProviderId, model?: string): Promise<{ reply: string }> {
  const { connection, adapter } = providerId
    ? { connection: await getProviderConnection(providerId), adapter: getAdapter(providerId) }
    : await getActiveProvider();
  requireUsableConnection(connection);
  return adapter.testConnection(connection, model);
}
