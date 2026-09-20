import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RecastPreset } from "../types.js";
import { createJsonArrayStore } from "./jsonArrayStore.js";
import { setActivePresetIdIfUnset } from "./recastSettingsStore.js";
import { getSettings } from "./settingsStore.js";

const FILE_PATH = path.resolve(process.cwd(), "data", "recastPresets.json");
const store = createJsonArrayStore<RecastPreset>("recastPresets.json");

// Ported from comfyinject3.0's sibling extension recast-post-processing's
// settings/defaultPresets.js — the two passes that ship enabled by default there.
const buildCharacterValidatorPrompt = (language: string): string => `You are a character consistency editor. Your only job is to fix dialog and actions that are not in character in <text_to_transform>. Do not improve prose. Do not fix grammar. Do not restructure sentences. Keep in mind you may not have received the whole scene context.
Priority order for character signals: example dialogue > personality traits > general description > scene context.

Fix text if it:
- Uses phrasing that contradicts the example dialogue voice
- Has the character act warmer, cooler, more helpful, or more dramatic than the card defines
- Responds only to the surface of what was said, ignoring what the other character is visibly feeling
- States emotion directly instead of showing it through behavior or word choice
- Resolves tension the character would hold

Keep the output in ${language} (image tags and proper nouns stay in English). Reproduce any \`⟦IMG:N⟧\` placeholder exactly as-is, byte for byte — never edit or remove it.

Return only the corrected text. No explanations, no commentary.`;

const buildProseRhythmPrompt = (language: string): string => `You are a prose editor. Your only job is to improve how <text_to_transform> reads without changing what it says.
Rules:
- Do not change any dialogue. Not a single word.
- Do not change what happens, what characters do, or the order of events
- Do not add new actions, reactions, or details that weren't there
- Do not remove actions, reactions, or details that were there
- Write in the verb tenses the original text is written, keeping the grammatical person as well.
- Prioritize avoiding repetition of descriptive words by changing the phrase or removing it altogether

What you may change:
- Sentence length variation, break up monotonous rhythm, mix short and long
- Eliminate repeated sentence structures, especially consecutive sentences starting the same way
- Convert telling to showing, remove emotion labels and replace with physical behavior or action
- Cut filler phrases that carry no meaning
- Tighten overly wordy constructions without losing meaning
- Favor flowing sentences connected by conjunctions over short stopped ones

Use the scene context only to match the established prose tone and style of the exchange. Do not drift from the register already set.

Keep the output in ${language} (image tags and proper nouns stay in English). Reproduce any \`⟦IMG:N⟧\` placeholder exactly as-is, byte for byte — never edit or remove it.

Return only the rewritten text. No explanations, no notes, no commentary.`;

function buildDefaultPreset(language: string): RecastPreset {
  return {
    id: randomUUID(),
    name: "Default",
    passes: [
      {
        id: randomUUID(),
        name: "Character Behavior Validator",
        enabled: true,
        contextLength: 7,
        includeCharCard: true,
        includeSceneContext: true,
        prompt: buildCharacterValidatorPrompt(language),
      },
      {
        id: randomUUID(),
        name: "Prose Rhythm",
        enabled: true,
        contextLength: 13,
        includeCharCard: false,
        includeSceneContext: true,
        prompt: buildProseRhythmPrompt(language),
      },
    ],
  };
}

let seedPromise: Promise<void> | null = null;

// Checks the file's real existence (not list().length === 0, which can't tell "never
// existed" apart from "user deleted every preset on purpose").
function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = access(FILE_PATH)
      .catch(async () => {
        // The passes keep the language they were seeded with: they are stored prompts the user can
        // edit, so a later change of output language does not rewrite them behind their back.
        const settings = await getSettings();
        const preset = buildDefaultPreset(settings.outputLanguage?.trim() || "Spanish");
        await store.create(preset);
        await setActivePresetIdIfUnset(preset.id);
      })
      .then(() => undefined);
  }
  return seedPromise;
}

export async function listRecastPresets(): Promise<RecastPreset[]> {
  await ensureSeeded();
  return store.list();
}

export function createRecastPreset(fields: { name: string; passes: RecastPreset["passes"] }): Promise<RecastPreset> {
  return store.create({ id: randomUUID(), ...fields });
}

export function updateRecastPreset(
  id: string,
  fields: { name: string; passes: RecastPreset["passes"] },
): Promise<RecastPreset | null> {
  return store.update(id, fields);
}

export const deleteRecastPreset = (id: string): Promise<boolean> => store.remove(id);
