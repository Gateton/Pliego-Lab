import type { RecastSettings } from "../types.js";
import { createJsonObjectStore } from "./jsonObjectStore.js";

const DEFAULT_SETTINGS: RecastSettings = {
  enabled: false,
  autoRun: true,
  activePresetId: null,
  minChars: 20,
  sceneContextAsRoles: false,
};

const store = createJsonObjectStore<RecastSettings>("recastSettings.json", DEFAULT_SETTINGS);

export const getRecastSettings = store.get;
export const updateRecastSettings = store.update;

/** Used by recastPresetStore when it seeds the first default preset — only sets it if unset. */
export async function setActivePresetIdIfUnset(id: string): Promise<void> {
  const current = await getRecastSettings();
  if (current.activePresetId === null) {
    await updateRecastSettings({ ...current, activePresetId: id });
  }
}
