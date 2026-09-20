import type { ImageDirectorSettings } from "../types.js";
import { createJsonObjectStore } from "./jsonObjectStore.js";

// These behaviors used to be user toggles. They are now unconditional (see imageDirector.ts), so
// the fields are gone from the type entirely — a legacy `false` stored on disk can no longer turn
// them off. The old keys are simply ignored when the saved JSON is merged over these defaults.
const DEFAULT_SETTINGS: ImageDirectorSettings = {
  enabled: false,
  model: "",
  maxImagesPerTurn: 3,
  instructionPrompt: "",
  jailbreakEnabled: false,
  jailbreakPrompt: "",
  triggerMode: "manual",
  includeCharacterContext: true,
  includePersonaContext: false,
  contextDepth: 5,
  temperature: 0.4,
  top_p: 1,
  max_tokens: 2000,
  thinkingEffort: "auto",
  minTagsPerImage: 0,
  directorTimeoutSeconds: 240,
};

const store = createJsonObjectStore<ImageDirectorSettings>("imageDirectorSettings.json", DEFAULT_SETTINGS);

const KNOWN_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof ImageDirectorSettings)[];

/**
 * Drops any keys no longer part of the schema (the removed toggles) before the settings ever
 * reach a caller, so a stale `false` on disk cannot reappear in the API response. The cleaned
 * object is what a later PUT writes back, so the file self-heals on the next save.
 */
export async function getImageDirectorSettings(): Promise<ImageDirectorSettings> {
  const saved = await store.get();
  const clean = { ...DEFAULT_SETTINGS } as unknown as Record<string, unknown>;
  for (const key of KNOWN_KEYS) {
    clean[key] = (saved as unknown as Record<string, unknown>)[key];
  }
  return clean as unknown as ImageDirectorSettings;
}

export const updateImageDirectorSettings = store.update;
