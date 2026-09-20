import { useCallback, useEffect, useState } from "react";
import * as estudioApi from "../api/estudio";
import type { AddonsSettings } from "../types/addons";

export function useAddonsSettings() {
  const [settings, setSettings] = useState<AddonsSettings | null>(null);

  const refresh = useCallback(async () => {
    setSettings(await estudioApi.getAddonsSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (next: AddonsSettings) => {
    setSettings(await estudioApi.updateAddonsSettings(next));
  }, []);

  return { settings, refresh, update };
}
