import type { SamplingPreset } from "../types.js";
import { getSettings, patchSettings } from "./settingsStore.js";
import { createSamplingPreset, listSamplingPresets } from "./samplingPresetStore.js";
import { PUBLIC_DEFAULT_PRESET } from "./presetDefaults.js";

/** Seeds the public Default preset once and selects it only when no valid preset is active. */
export async function seedDefaultSamplingPreset(): Promise<SamplingPreset> {
  let presets = await listSamplingPresets();
  let defaultPreset = presets.find((preset) => preset.name.trim().toLocaleLowerCase() === "default");

  if (!defaultPreset) {
    defaultPreset = await createSamplingPreset(PUBLIC_DEFAULT_PRESET);
    presets = [...presets, defaultPreset];
  }

  const settings = await getSettings();
  const hasActivePreset = settings.activeSamplingPresetId !== null && presets.some((preset) => preset.id === settings.activeSamplingPresetId);
  if (!hasActivePreset) await patchSettings({ activeSamplingPresetId: defaultPreset.id });

  return defaultPreset;
}
