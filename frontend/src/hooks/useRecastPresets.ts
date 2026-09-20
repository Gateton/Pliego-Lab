import { useCallback, useEffect, useState } from "react";
import * as recastApi from "../api/recast";
import type { RecastPreset } from "../types/recast";

export function useRecastPresets() {
  const [presets, setPresets] = useState<RecastPreset[]>([]);

  const refresh = useCallback(async () => {
    setPresets(await recastApi.listPresets());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (fields: { name: string; passes: RecastPreset["passes"] }) => {
      await recastApi.createPreset(fields);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, fields: { name: string; passes: RecastPreset["passes"] }) => {
      await recastApi.updatePreset(id, fields);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await recastApi.deletePreset(id);
      await refresh();
    },
    [refresh],
  );

  return { presets, refresh, create, update, remove };
}
