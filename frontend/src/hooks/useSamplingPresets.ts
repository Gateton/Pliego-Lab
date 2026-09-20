import { useCallback, useEffect, useState } from "react";
import * as presetsApi from "../api/samplingPresets";
import type { SamplingPreset } from "../types/samplingPreset";

export function useSamplingPresets() {
  const [presets, setPresets] = useState<SamplingPreset[]>([]);

  const refresh = useCallback(async () => {
    setPresets(await presetsApi.listSamplingPresets());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (fields: Omit<SamplingPreset, "id">) => {
      const created = await presetsApi.createSamplingPreset(fields);
      await refresh();
      return created;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, fields: Omit<SamplingPreset, "id">) => {
      const updated = await presetsApi.updateSamplingPreset(id, fields);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await presetsApi.deleteSamplingPreset(id);
      await refresh();
    },
    [refresh],
  );

  return { presets, refresh, create, update, remove };
}
