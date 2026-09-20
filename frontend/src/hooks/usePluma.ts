import { useCallback, useEffect, useState } from "react";
import * as plumaApi from "../api/pluma";
import type { PlumaSettings } from "../types/pluma";

export function usePluma() {
  const [settings, setSettings] = useState<PlumaSettings | null>(null);

  const refresh = useCallback(async () => {
    setSettings(await plumaApi.getPlumaSettings());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (next: PlumaSettings) => {
    setSettings(await plumaApi.updatePlumaSettings(next));
  }, []);

  return { settings, update, refresh };
}
