import type { SamplingPreset } from "../types/samplingPreset";

/**
 * Name of the code-level fallback preset. It never reaches the screen: this preset is not listed
 * anywhere (the preset list comes from the API) and only feeds generation parameters through
 * `resolvePreset` below, so the name is a data placeholder rather than interface copy and stays out
 * of the catalogs.
 */
const FALLBACK_PRESET_NAME = "Default";

/**
 * Code-level fallback for when no preset is active (e.g. the seeded "Default" was deleted).
 * Keeps generation deterministic without reintroducing global generation settings.
 */
export const DEFAULT_PRESET: SamplingPreset = {
  id: "__default__",
  name: FALLBACK_PRESET_NAME,
  temperature: 0.9,
  top_p: 0.95,
  top_k: 0,
  repetition_penalty: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  max_tokens: 20000,
  min_p: 0,
  seed: -1,
  n: 1,
  maxContextTokens: 200000,
  reasoningEnabled: true,
  reasoningEffort: "low",
  verbosity: "auto",
  squashSystemMessages: false,
  strictAlternation: false,
};

export function resolvePreset(presets: SamplingPreset[], activeId: string | null): SamplingPreset {
  const found = activeId ? presets.find((preset) => preset.id === activeId) : undefined;
  return { ...DEFAULT_PRESET, ...(found ?? {}) };
}
