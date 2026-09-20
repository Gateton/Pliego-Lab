import type { CharacterSummary } from "../types/character";

/** Returns only characters created or imported by the user. System cards stay visible in the library. */
export function getUserCharacters(characters: CharacterSummary[]): CharacterSummary[] {
  return characters.filter((character) => character.isSystem !== true);
}
