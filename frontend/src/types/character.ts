export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  imageTags: string;
  creator: string;
  character_version: string;
  character_book?: Record<string, unknown>;
  lorebookIds?: string[];
  // True for a "world"/scenario card (a whole setting, not a person) — excludes it from
  // NPC Tracker's includeMainCharacter entirely, regardless of the global toggle.
  isWorld?: boolean;
}

export interface CharacterSummary {
  id: string;
  name: string;
  tags: string[];
  addedAt: number;
  /** mtime of the card PNG, used to pin avatar URLs so they can be cached indefinitely. */
  mtimeMs: number;
  isWorld?: boolean;
  /** True for cards shipped by Pliego Lab rather than created or imported by the user. */
  isSystem?: boolean;
}
