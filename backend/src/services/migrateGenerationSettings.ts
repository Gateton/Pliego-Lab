import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// One-time migration: generation/response settings used to live in settings.json (next to UI
// prefs) while the sampling parameters lived per preset — two sources of truth for the same
// request. They now belong to the preset (see SamplingPreset in types.ts). This copies the old
// global values into every existing preset and, when there is no active preset to carry them,
// seeds a "Default" preset from the old fallback model so behavior is preserved exactly.
const SETTINGS_PATH = path.resolve(process.cwd(), "data", "settings.json");
const PRESETS_PATH = path.resolve(process.cwd(), "data", "samplingPresets.json");

const LEGACY_KEYS = [
  "fallbackModel",
  "contextSizeTokens",
  "requestModelReasoning",
  "reasoningEffort",
  "verbosity",
  "squashSystemMessages",
  "strictAlternation",
] as const;

const DEFAULT_CONTEXT_TOKENS = 8000;
const DEFAULT_MODEL = "openai/gpt-4o-mini";

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, filePath);
}

type RawSettings = Record<string, unknown>;
type RawPreset = Record<string, unknown> & { id?: string; name?: string };

function isEffort(value: unknown): value is "auto" | "low" | "medium" | "high" {
  return value === "auto" || value === "low" || value === "medium" || value === "high";
}

export async function migrateGenerationSettings(): Promise<void> {
  const settings = await readJson<RawSettings>(SETTINGS_PATH);
  if (!settings) return; // No settings file yet → fresh install, nothing to migrate.
  if (!LEGACY_KEYS.some((key) => key in settings)) return; // Already migrated → idempotent.

  const legacy = {
    model: typeof settings.fallbackModel === "string" && settings.fallbackModel.trim() ? settings.fallbackModel : DEFAULT_MODEL,
    maxContextTokens:
      typeof settings.contextSizeTokens === "number" && settings.contextSizeTokens > 0 ? settings.contextSizeTokens : DEFAULT_CONTEXT_TOKENS,
    reasoningEnabled: settings.requestModelReasoning === true,
    reasoningEffort: isEffort(settings.reasoningEffort) ? settings.reasoningEffort : "auto",
    verbosity: isEffort(settings.verbosity) ? settings.verbosity : "auto",
    squashSystemMessages: settings.squashSystemMessages === true,
    strictAlternation: settings.strictAlternation === true,
  };

  const presets = ((await readJson<RawPreset[]>(PRESETS_PATH)) ?? []).map((preset) => ({
    maxContextTokens: legacy.maxContextTokens,
    reasoningEnabled: legacy.reasoningEnabled,
    reasoningEffort: legacy.reasoningEffort,
    verbosity: legacy.verbosity,
    squashSystemMessages: legacy.squashSystemMessages,
    strictAlternation: legacy.strictAlternation,
    ...preset,
  })) as RawPreset[];

  const activeId = typeof settings.activeSamplingPresetId === "string" ? settings.activeSamplingPresetId : null;
  const hasActive = activeId !== null && presets.some((preset) => preset.id === activeId);

  if (!hasActive) {
    // No active preset to inherit the generation settings — seed one so the app keeps a single
    // source of truth instead of falling back to values that no longer exist globally.
    // Prompts are NOT copied: they stay global and apply whenever the preset defines none.
    const defaultPreset: RawPreset = {
      id: randomUUID(),
      name: "Default",
      model: legacy.model,
      maxContextTokens: legacy.maxContextTokens,
      reasoningEnabled: legacy.reasoningEnabled,
      reasoningEffort: legacy.reasoningEffort,
      verbosity: legacy.verbosity,
      squashSystemMessages: legacy.squashSystemMessages,
      strictAlternation: legacy.strictAlternation,
    };
    presets.push(defaultPreset);
    settings.activeSamplingPresetId = defaultPreset.id;
  }

  await writeJson(PRESETS_PATH, presets);

  for (const key of LEGACY_KEYS) delete settings[key];
  await writeJson(SETTINGS_PATH, settings);

  console.log(`[migrateGenerationSettings] moved generation settings into ${presets.length} preset(s)`);
}
