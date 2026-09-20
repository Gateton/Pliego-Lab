import type { CharacterCard } from "../types/character";
import type { Persona } from "../types/persona";

export type MacroDict = Record<string, string>;

/** Replaces {{key}} placeholders using the dict; unknown keys are left untouched. */
export function substituteMacros(text: string, dict: MacroDict): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = dict[key];
    return value !== undefined ? value : match;
  });
}

export function buildBaseDict(character: CharacterCard | null, persona: Persona | null): MacroDict {
  return {
    user: persona?.name || "User",
    char: character?.name || "Assistant",
    persona: persona?.description ?? "",
    scenario: character?.scenario ?? "",
    char_description: character?.description ?? "",
    personality: character?.personality ?? "",
    char_image_tags: character?.imageTags ?? "",
  };
}

/**
 * Resolves a character-overridable field (system_prompt / post_history_instructions):
 * the character's value wins if non-empty, otherwise the global default is used.
 * {{original}} inside the character's value refers to the global default, so a card
 * can say "use this in addition to {{original}}" instead of fully replacing it.
 */
export function resolveOverridable(characterValue: string, globalDefault: string, dict: MacroDict): string {
  const effective = characterValue.trim() ? characterValue : globalDefault;
  return substituteMacros(effective, { ...dict, original: globalDefault });
}
