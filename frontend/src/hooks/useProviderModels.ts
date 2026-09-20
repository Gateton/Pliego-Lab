import { useCallback, useEffect, useState } from "react";
import * as providersApi from "../api/providers";
import { t } from "../i18n";
import { useProviders } from "./useProviders";
import type { ModelDescriptor, ProviderId } from "../types/provider";

/** Live model list for one provider. Reloads whenever the provider (or its base URL) changes. */
export function useProviderModels(providerId: ProviderId | null, baseUrl?: string) {
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!providerId) {
      setModels([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setModels(await providersApi.listProviderModels(providerId));
    } catch (err) {
      setModels([]);
      setError(err instanceof Error ? err.message : t("settings.providers.modelsFailed"));
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  // `baseUrl` is not read by `reload` itself (the API reads the stored endpoint server-side) but
  // a change to it must refetch, so it stays in the effect's dependency list.
  useEffect(() => {
    void reload();
  }, [reload, baseUrl]);

  return { models, loading, error, reload };
}

/** Convenience wrapper for panels that just need "the models of whatever provider is active". */
export function useActiveProviderModels() {
  const { active } = useProviders();
  return useProviderModels(active?.id ?? null, active?.baseUrl);
}
