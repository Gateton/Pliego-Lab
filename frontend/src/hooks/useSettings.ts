import { useCallback, useEffect, useState } from "react";
import * as settingsApi from "../api/settings";
import type { AppSettings } from "../types/settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const refresh = useCallback(async () => {
    setSettings(await settingsApi.getSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (next: AppSettings) => {
    setSettings(await settingsApi.updateSettings(next));
  }, []);

  return { settings, refresh, update };
}
