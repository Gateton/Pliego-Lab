import type { CharacterCard } from "../types.js";

export type CharacterFields = Omit<CharacterCard, "id">;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Normalizes a raw parsed character JSON (V1 flat, or V2/V3 with a `data` wrapper) into our internal shape. */
export function normalizeCardJson(raw: unknown): CharacterFields {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const isWrapped = obj.spec !== undefined;
  const source = isWrapped && obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : obj;

  return {
    name: str(source.name),
    description: str(source.description),
    personality: str(source.personality),
    scenario: str(source.scenario),
    first_mes: str(source.first_mes),
    mes_example: str(source.mes_example),
    creator_notes: str(source.creator_notes),
    system_prompt: str(source.system_prompt),
    post_history_instructions: str(source.post_history_instructions),
    tags: strArray(source.tags),
    imageTags: str(source.imageTags ?? source.image_tags),
    creator: str(source.creator),
    character_version: str(source.character_version),
    character_book: source.character_book && typeof source.character_book === "object"
      ? source.character_book as Record<string, unknown>
      : undefined,
    lorebookIds: strArray(source.lorebookIds ?? source.lorebook_ids),
  };
}

/** Wraps a character card into a V2-spec-compliant JSON string for PNG export. */
export function toCardV2Json(card: CharacterCard): string {
  const { id: _id, ...fields } = card;
  return JSON.stringify({
    ...fields,
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      ...fields,
      alternate_greetings: [],
      character_book: fields.character_book,
      extensions: {
        world: fields.lorebookIds?.[0],
        silly_gateton_lorebook_ids: fields.lorebookIds ?? [],
      },
    },
  });
}
