import { resolvePreset } from "../presetDefaults.js";
import { listSamplingPresets } from "../samplingPresetStore.js";
import { getSettings } from "../settingsStore.js";

/**
 * The model memory calls use: an explicit request override, then the model chosen in the memory
 * settings, then the model the chat itself runs on (the active preset). Without that last step an
 * empty memory model fell through to the provider's own default, which may not be the model the
 * user picked, or may not be set at all.
 */
export async function resolveMemoryModel(requested: unknown, configured: string): Promise<string | undefined> {
  if (typeof requested === "string" && requested.trim()) return requested.trim();
  if (configured.trim()) return configured.trim();
  try {
    const [settings, presets] = await Promise.all([getSettings(), listSamplingPresets()]);
    const model = resolvePreset(presets, settings.activeSamplingPresetId).model;
    return typeof model === "string" && model.trim() ? model.trim() : undefined;
  } catch {
    return undefined;
  }
}
