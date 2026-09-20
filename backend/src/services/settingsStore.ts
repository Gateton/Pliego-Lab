import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSettings, PromptBlock } from "../types.js";
import { dataPath } from "./paths.js";

const FILE_PATH = dataPath("settings.json");
const dirReady = mkdir(path.dirname(FILE_PATH), { recursive: true });

const DEFAULT_SETTINGS: AppSettings = {
  contextTemplate: "{{system}}\n{{char_description}}\n{{personality}}\nScenario: {{scenario}}",
  contextTemplateEnabled: true,
  promptBlocks: [],
  defaultPersonaId: null,
  activeSamplingPresetId: null,
  streaming: true,
  chatFontSize: 16,
  chatImageSize: 100,
  density: "comfortable",
  outputLanguage: "",
  coloredDialogue: true,
  favoriteCharacterIds: [],
  onboardingWizardVersion: null,
  onboardingTourVersion: null,
};

let writeQueue: Promise<void> = Promise.resolve();

export async function getSettings(): Promise<AppSettings> {
  await dirReady;
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_SETTINGS;
    throw error;
  }
}

export function updateSettings(settings: AppSettings): Promise<AppSettings> {
  const result = writeQueue.then(async () => {
    const tmpPath = `${FILE_PATH}.tmp`;
    await writeFile(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
    await rename(tmpPath, FILE_PATH);
    return settings;
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Applies a partial update on top of the stored settings, inside the same write queue as
 * `updateSettings` so two writers can never interleave a read-modify-write. Used by the settings
 * route (its payload is a whitelist, not a whole object) and by the onboarding endpoint.
 */
export function patchSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const result = writeQueue.then(async () => {
    const next = { ...(await getSettings()), ...patch };
    const tmpPath = `${FILE_PATH}.tmp`;
    await writeFile(tmpPath, JSON.stringify(next, null, 2), "utf-8");
    await rename(tmpPath, FILE_PATH);
    return next;
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Appends imported prompt blocks to the global prompt manager (used by ST preset import). */
export async function appendPromptBlocks(blocks: PromptBlock[]): Promise<void> {
  const settings = await getSettings();
  settings.promptBlocks = [...settings.promptBlocks, ...blocks];
  await updateSettings(settings);
}
