import type { SamplingPreset } from "../types.js";
import { parseCompletionPreset } from "./sillyTavernImport.js";
import { parsePresetFields } from "./samplingPresetFields.js";

/**
 * Import of response presets from an uploaded JSON file.
 *
 * Two shapes are accepted, and the format is detected per object:
 *  - SillyTavern Chat Completion presets (`prompts[]`, `prompt_manager`, `openai_max_tokens`…),
 *    mapped by `parseCompletionPreset`.
 *  - Pliego's own preset objects (the ones stored in `data/samplingPresets.json`), which are the
 *    natural export format once presets can be shared.
 *
 * A file may carry a single preset, an array of presets, or `{ presets: [...] }`, so one backup
 * file imports in one go.
 */

/** Keys that only ever appear in a SillyTavern completion preset. */
const ST_MARKERS = [
  "prompts",
  "prompt_manager",
  "prompt_order",
  "openai_max_tokens",
  "openrouter_model",
  "stream_openai",
  "wrap_in_quotes",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Native presets always carry `promptBlocks` (possibly empty), so that field wins over the ST
 * markers: a preset that already speaks our shape is never re-parsed as a foreign one.
 */
function looksLikeSillyTavern(raw: Record<string, unknown>): boolean {
  if (Array.isArray(raw.promptBlocks)) return false;
  return ST_MARKERS.some((marker) => marker in raw);
}

/** Normalizes the uploaded payload into the list of preset objects it contains, or null. */
export function extractPresetObjects(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    const objects = data.filter(isRecord);
    return objects.length > 0 ? objects : null;
  }
  if (!isRecord(data)) return null;
  if (Array.isArray(data.presets)) {
    const objects = data.presets.filter(isRecord);
    return objects.length > 0 ? objects : null;
  }
  return [data];
}

/** Maps one uploaded preset object to Pliego's contract, throwing when it carries no usable name. */
export function parseImportedPreset(raw: Record<string, unknown>, fallbackName: string): Omit<SamplingPreset, "id"> {
  const ownName = typeof raw.name === "string" ? raw.name.trim() : "";
  const name = ownName || fallbackName.trim();
  if (!name) throw new Error("The preset has no name");
  if (looksLikeSillyTavern(raw)) return parseCompletionPreset(raw, name).preset;
  return { name, ...parsePresetFields(raw) };
}
