import { useCallback, useEffect, useState } from "react";
import * as comfyInjectApi from "../api/comfyInject";
import type { ComfyInjectSettings } from "../types/comfyInject";

export function useComfyInjectSettings() {
  const [settings, setSettings] = useState<ComfyInjectSettings | null>(null);
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [diffusionModels, setDiffusionModels] = useState<string[]>([]);
  const [textEncoders, setTextEncoders] = useState<string[]>([]);
  const [vaes, setVaes] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [loadedSettings, loadedWorkflows] = await Promise.all([
      comfyInjectApi.getSettings(),
      comfyInjectApi.listWorkflows(),
    ]);
    setSettings(loadedSettings);
    setWorkflows(loadedWorkflows);
    // Best-effort: ComfyUI may be offline. Each list fails independently so a dead host
    // never blocks settings from loading — the fields just fall back to plain free text.
    comfyInjectApi.listCheckpoints().then(setCheckpoints).catch(() => setCheckpoints([]));
    comfyInjectApi.listDiffusionModels().then(setDiffusionModels).catch(() => setDiffusionModels([]));
    comfyInjectApi.listTextEncoders().then(setTextEncoders).catch(() => setTextEncoders([]));
    comfyInjectApi.listVaes().then(setVaes).catch(() => setVaes([]));
    comfyInjectApi.listLoras().then(setLoras).catch(() => setLoras([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(async (next: ComfyInjectSettings) => {
    setSettings(await comfyInjectApi.updateSettings(next));
  }, []);

  return { settings, workflows, checkpoints, diffusionModels, textEncoders, vaes, loras, refresh, update };
}
