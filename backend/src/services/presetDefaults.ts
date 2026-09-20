import type { SamplingPreset } from "../types.js";

/**
 * Code-level fallback used only when no preset is active (e.g. the user deleted the seeded
 * "Default" preset). It keeps generation deterministic without reintroducing global generation
 * settings — the preset list remains the single place the user edits.
 */
export const PUBLIC_DEFAULT_PRESET: Omit<SamplingPreset, "id"> = {
  name: "Default",
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

export const DEFAULT_PRESET: SamplingPreset = {
  id: "__default__",
  ...PUBLIC_DEFAULT_PRESET,
};

export function resolvePreset(presets: SamplingPreset[], activeId: string | null): SamplingPreset {
  const found = activeId ? presets.find((preset) => preset.id === activeId) : undefined;
  return { ...DEFAULT_PRESET, ...(found ?? {}) };
}
