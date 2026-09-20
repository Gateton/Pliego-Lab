// Resolves a provider id into a ready-to-call connection: adapter identity + capabilities +
// endpoint (default or user override) + API key (secrets.json, falling back to the environment).

import { getProviderSettings } from "../providerSettingsStore.js";
import { getAdapter, isProviderId } from "./registry.js";
import { resolveApiKey } from "../secretsStore.js";
import type { ProviderConnection, ProviderId } from "./types.js";

async function buildConnection(id: ProviderId): Promise<ProviderConnection> {
  const adapter = getAdapter(id);
  const settings = await getProviderSettings();
  const override = settings.providers[id];
  const baseUrl = (override?.baseUrl?.trim() || adapter.defaultBaseUrl).replace(/\/+$/, "");
  const apiKey = await resolveApiKey(id);
  return {
    id,
    label: adapter.label,
    requiresApiKey: adapter.requiresApiKey,
    baseUrl,
    apiKey,
    extraHeaders: override?.extraHeaders ?? {},
    capabilities: adapter.capabilities,
    defaultModel: adapter.defaultModel,
    defaultEmbeddingModel: adapter.defaultEmbeddingModel,
  };
}

export async function getActiveProviderId(): Promise<ProviderId> {
  const settings = await getProviderSettings();
  return isProviderId(settings.activeProviderId) ? settings.activeProviderId : "openrouter";
}

export async function getProviderConnection(id: ProviderId): Promise<ProviderConnection> {
  return buildConnection(id);
}

export async function getActiveProvider(): Promise<{
  connection: ProviderConnection;
  adapter: ReturnType<typeof getAdapter>;
}> {
  const id = await getActiveProviderId();
  return { connection: await buildConnection(id), adapter: getAdapter(id) };
}

/** Throws a clear, user-facing error when the active provider is not usable as configured. */
export function requireUsableConnection(connection: ProviderConnection): void {
  if (!connection.baseUrl.trim()) {
    throw new Error(`Provider "${connection.label}" has no Base URL configured. Set it in Presets → Provider.`);
  }
  if (connection.requiresApiKey && !connection.apiKey) {
    throw new Error(`Provider "${connection.label}" has no API key configured. Set it in Presets → Provider.`);
  }
}
