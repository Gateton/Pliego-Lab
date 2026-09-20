import type { RecastPreset } from "../types/recast";
import { t } from "../i18n";

// Faithful port of the original Recast extension's "Default Preset" (settings/defaultPresets.js):
// a chain of the four standard passes, with the same prompts. Provides a ready-to-use pipeline.
//
// The preset and pass names are read on screen (the Recast preset list, the pass name fields) and
// stay editable, so they are interface copy and come from the catalog, resolved when the example is
// loaded. They are the original extension's names, already English, so both catalogs carry the same
// value. The `prompt` bodies are not copy: each one is an instruction sent to the model as the pass
// prompt, so it is deliberately left in English and out of the catalogs (see the i18n brief).
export function buildDefaultRecastPreset(): RecastPreset {
  return {
    id: crypto.randomUUID(),
    name: t("presets.recast.example.name"),
    passes: [
      {
        id: crypto.randomUUID(),
        name: t("presets.recast.example.grounding"),
        enabled: false,
        contextLength: 3,
        prompt: `You are a prose editor. Edit <text_to_transform> so it feels rooted in the story's world, consistent with its rules, tone, setting, and the way things work there. Making it feels like it belongs to this specific world. Do not make slop or guesswork.
Essentially make the text make sense, apply crude logic and reactions from the world, scene and characters.
You don't have context about the scene, keep that in mind.

When a character announces an action and then immediately executes it or time passes, add one short beat between the two so the reader doesn't feel like they blinked and missed the transition. It can be a reaction, a half-second, anything that confirms time moved.

Return only the rewritten text. No explanations, no notes, no commentary.`,
        includeCharCard: true,
        includeSceneContext: true,
      },
      {
        id: crypto.randomUUID(),
        name: t("presets.recast.example.characterBehaviorValidator"),
        enabled: true,
        contextLength: 7,
        prompt: `You are a character consistency editor. Your only job is to fix dialog and actions that are not in character in <text_to_transform>. Do not improve prose. Do not fix grammar. Do not restructure sentences. Keep in mind you may not have received the whole scene context.
Priority order for character signals: example dialogue > personality traits > general description > scene context.

Fix text if it:
- Uses phrasing that contradicts the example dialogue voice
- Has the character act warmer, cooler, more helpful, or more dramatic than the card defines
- Responds only to the surface of what was said, ignoring what the other character is visibly feeling
- States emotion directly instead of showing it through behavior or word choice
- Resolves tension the character would hold

Return only the corrected text. No explanations, no commentary.`,
        includeCharCard: true,
        includeSceneContext: true,
      },
      {
        id: crypto.randomUUID(),
        name: t("presets.recast.example.proseRhythm"),
        enabled: true,
        contextLength: 13,
        prompt: `You are a prose editor. Your only job is to improve how <text_to_transform> reads without changing what it says.
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

Return only the rewritten text. No explanations, no notes, no commentary.`,
        includeCharCard: false,
        includeSceneContext: true,
      },
      {
        id: crypto.randomUUID(),
        name: t("presets.recast.example.repetitionHammer"),
        enabled: false,
        contextLength: 35,
        prompt: `Simply edit <text_to_transform> and remove all repeated words or dialogs from it.

Rules:
- Remove only words that are removable
- Change only if allows the text to still make sense
- Prioritize removing things seen in the more recent interactions

Return only the rewritten text. No explanations, no notes, no commentary. Think only once to avoid overthinking.`,
        includeCharCard: false,
        includeSceneContext: true,
      },
    ],
  };
}
