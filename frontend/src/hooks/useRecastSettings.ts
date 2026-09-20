import { useCallback, useEffect, useState } from "react";
import * as recastApi from "../api/recast";
import type { RecastSettings } from "../types/recast";

export function useRecastSettings() {
  const [settings, setSettings] = useState<RecastSettings | null>(null);

  const refresh = useCallback(async () => {
    setSettings(await recastApi.getSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (next: RecastSettings) => {
    setSettings(await recastApi.updateSettings(next));
  }, []);

  return { settings, refresh, update };
}
