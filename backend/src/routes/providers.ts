import { Router } from "express";
import { deleteApiKey, getKeyStatus, setApiKey } from "../services/secretsStore.js";
import { getProviderSettings, updateProviderSettings, type ProviderEndpointSettings } from "../services/providerSettingsStore.js";
import { getAdapter, isProviderId, PROVIDER_IDS } from "../services/providers/registry.js";
import { getProviderConnection } from "../services/providers/resolve.js";
import { ProviderRequestError, type ProviderId } from "../services/providers/types.js";
import { listModels, testConnection } from "../services/llm.js";
import { apiErrorBody } from "../services/apiError.js";

export const providersRouter = Router();

/** Rejects any provider id that isn't in the registry before it reaches a handler. */
providersRouter.param("id", (req, res, next, id) => {
  if (!isProviderId(id)) {
    res.status(404).json({ error: `Unknown provider: ${id}` });
    return;
  }
  next();
});

async function providerSummary(id: ProviderId) {
  const adapter = getAdapter(id);
  const settings = await getProviderSettings();
  const key = await getKeyStatus(id);
  const override = settings.providers[id];
  return {
    id,
    label: adapter.label,
    description: adapter.description,
    requiresApiKey: adapter.requiresApiKey,
    active: settings.activeProviderId === id,
    baseUrl: override?.baseUrl?.trim() || adapter.defaultBaseUrl,
    defaultBaseUrl: adapter.defaultBaseUrl,
    defaultModel: adapter.defaultModel,
    defaultEmbeddingModel: adapter.defaultEmbeddingModel,
    capabilities: adapter.capabilities,
    hasKey: key.hasKey,
    keyHint: key.hint,
    keyFromEnv: key.fromEnv,
  };
}

providersRouter.get("/", async (_req, res) => {
  res.json(await Promise.all(PROVIDER_IDS.map(providerSummary)));
});

providersRouter.put("/active", async (req, res) => {
  const { providerId } = req.body as { providerId?: unknown };
  if (!isProviderId(providerId)) {
    res.status(400).json(apiErrorBody("provider.unknown"));
    return;
  }
  const settings = await getProviderSettings();
  await updateProviderSettings({ ...settings, activeProviderId: providerId });
  res.json(await providerSummary(providerId));
});

providersRouter.put("/:id", async (req, res) => {
  const id = req.params.id as ProviderId;
  const { baseUrl, extraHeaders } = req.body as { baseUrl?: unknown; extraHeaders?: unknown };
  const settings = await getProviderSettings();
  const current: ProviderEndpointSettings = settings.providers[id] ?? {};
  const next: ProviderEndpointSettings = { ...current };
  if (typeof baseUrl === "string") {
    if (baseUrl.trim()) next.baseUrl = baseUrl.trim();
    else delete next.baseUrl;
  }
  if (extraHeaders && typeof extraHeaders === "object" && !Array.isArray(extraHeaders)) {
    const headers = Object.fromEntries(
      Object.entries(extraHeaders as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
    next.extraHeaders = headers;
  }
  // Drop the entry entirely once nothing is overridden, so the file stays free of empty objects.
  const providers = { ...settings.providers };
  if (Object.keys(next).length === 0) delete providers[id];
  else providers[id] = next;
  await updateProviderSettings({ ...settings, providers });
  res.json(await providerSummary(id));
});

providersRouter.put("/:id/key", async (req, res) => {
  const id = req.params.id as ProviderId;
  const { apiKey } = req.body as { apiKey?: unknown };
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    res.status(400).json(apiErrorBody("provider.apiKeyRequired"));
    return;
  }
  await setApiKey(id, apiKey);
  res.json({ ok: true });
});

providersRouter.delete("/:id/key", async (req, res) => {
  await deleteApiKey(req.params.id as ProviderId);
  res.status(204).end();
});

providersRouter.post("/:id/test", async (req, res) => {
  const id = req.params.id as ProviderId;
  const { model } = req.body as { model?: unknown };
  try {
    const connection = await getProviderConnection(id);
    const result = await testConnection(id, typeof model === "string" && model ? model : connection.defaultModel || undefined);
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 502;
    res.status(status).json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

providersRouter.get("/:id/models", async (req, res) => {
  try {
    res.json(await listModels(req.params.id as ProviderId));
  } catch (error) {
    const status = error instanceof ProviderRequestError ? error.status : 502;
    res.status(status).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
