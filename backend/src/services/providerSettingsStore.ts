import { createJsonObjectStore } from "./jsonObjectStore.js";
import type { ProviderId } from "./providers/types.js";

/** Per-provider endpoint overrides. Credentials live separately, in secretsStore. */
export interface ProviderEndpointSettings {
  baseUrl?: string;
  extraHeaders?: Record<string, string>;
}

export interface ProviderSettings {
  activeProviderId: ProviderId;
  providers: Partial<Record<ProviderId, ProviderEndpointSettings>>;
}

const DEFAULT_SETTINGS: ProviderSettings = {
  activeProviderId: "openrouter",
  providers: {},
};

const store = createJsonObjectStore<ProviderSettings>("providerSettings.json", DEFAULT_SETTINGS);

export const getProviderSettings = store.get;
export const updateProviderSettings = store.update;
