import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as presetsApi from "../api/samplingPresets";
import { t } from "../i18n";
import type { SamplingPreset } from "../types/samplingPreset";

/**
 * Shared store for response presets.
 *
 * Every consumer used to hold its own copy fetched on mount, so a preset created or imported in
 * one place (the SillyTavern import panel, the preset manager, the first-run wizard) left the
 * others — most visibly the Response panel on the left — showing stale data until a reload. One
 * module-level store keeps every mounted `useSamplingPresets` in sync, and any code that writes
 * presets outside the hook (the import panel) can call `refreshSamplingPresets()` to broadcast.
 */
let presets: SamplingPreset[] = [];
let loadStarted = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SamplingPreset[] {
  return presets;
}

async function load() {
  presets = await presetsApi.listSamplingPresets();
  emit();
}

/** Re-reads every preset from the backend and notifies all mounted consumers. */
export async function refreshSamplingPresets(): Promise<void> {
  await load();
}

function ensureLoaded() {
  if (loadStarted) return;
  loadStarted = true;
  void load().catch(() => {
    // A failed first load must not leave the store permanently "loaded": allow a later retry.
    loadStarted = false;
  });
}

export function useSamplingPresets() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureLoaded();
  }, []);

  const create = useCallback(async (fields: Omit<SamplingPreset, "id">) => {
    const created = await presetsApi.createSamplingPreset(fields);
    await load();
    return created;
  }, []);

  const update = useCallback(async (id: string, fields: Omit<SamplingPreset, "id">) => {
    const updated = await presetsApi.updateSamplingPreset(id, fields);
    await load();
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await presetsApi.deleteSamplingPreset(id);
    await load();
  }, []);

  /**
   * Imports a preset from a JSON file the user picked. Accepts Pliego presets and SillyTavern
   * completion presets; the file name is the fallback name. Refreshes the shared store so every
   * consumer (including the Response panel) sees the new presets immediately.
   */
  const importFile = useCallback(async (file: File) => {
    const text = await file.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(t("presets.manager.importInvalidJson"));
    }
    const result = await presetsApi.importSamplingPresets(file.name.replace(/\.json$/i, ""), data);
    await load();
    return result;
  }, []);

  return { presets: current, refresh: refreshSamplingPresets, create, update, remove, importFile };
}
