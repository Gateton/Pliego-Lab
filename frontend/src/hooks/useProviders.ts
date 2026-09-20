import { useCallback, useEffect, useState } from "react";
import * as providersApi from "../api/providers";
import { t } from "../i18n";
import type { ProviderId, ProviderSummary } from "../types/provider";

export function useProviders() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProviders(await providersApi.listProviders());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.providers.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActive = useCallback(
    async (providerId: ProviderId) => {
      await providersApi.setActiveProvider(providerId);
      await refresh();
    },
    [refresh],
  );

  const saveProvider = useCallback(
    async (providerId: ProviderId, patch: { baseUrl?: string }) => {
      await providersApi.updateProvider(providerId, patch);
      await refresh();
    },
    [refresh],
  );

  const setKey = useCallback(
    async (providerId: ProviderId, apiKey: string) => {
      await providersApi.setProviderKey(providerId, apiKey);
      await refresh();
    },
    [refresh],
  );

  const deleteKey = useCallback(
    async (providerId: ProviderId) => {
      await providersApi.deleteProviderKey(providerId);
      await refresh();
    },
    [refresh],
  );

  const active = providers.find((p) => p.active) ?? null;

  return { providers, active, loading, error, refresh, setActive, saveProvider, setKey, deleteKey };
}
