/**
 * User-facing API errors.
 *
 * Every entry is a situation the person in front of the app has to fix, and the code is what the
 * frontend translates: the text here is the canonical English fallback, shown when a code has no
 * translation yet. Validation errors that the interface already prevents (`name is required` and
 * friends) stay inline in their route — nobody sees them, and turning them into codes would only
 * make the protocol look bigger than it is.
 *
 * The frontend keeps the code → translation map in `src/i18n/apiErrors.ts`, and
 * `npm run i18n:check` fails when the two lists drift apart.
 */
export const API_ERRORS = {
  // SillyTavern import
  "st.pathRequired": "Set the SillyTavern folder in Settings first.",
  "st.notAnInstall": "That does not look like a SillyTavern installation (no data/<user> folder).",
  "st.noUser": "No SillyTavern user was found in that folder.",

  // Usage
  "usage.openRouterOnly": "Usage and cost is only available with OpenRouter as the active provider.",

  // Characters
  "character.notFound": "Character not found.",
  "character.noName": "The character card has no name.",
  "character.pngRequired": "A PNG file is required.",
  "character.invalidJson": "The character JSON is not valid.",
  "character.noGreeting": "This character has no greeting to translate.",

  // Lorebooks
  "lorebook.notFound": "Lorebook not found.",
  "lorebook.nameRequired": "The lorebook needs a name.",
  "lorebook.invalidFile": "The file does not contain a valid lorebook.",
  "lorebook.invalidJsonFile": "The JSON file is not valid.",

  // Chats, personas and presets
  "chat.notFound": "Chat not found.",
  "persona.notFound": "Persona not found.",
  "preset.notFound": "Sampling preset not found.",
  "preset.importInvalid": "The file does not contain a valid preset (neither a Pliego preset nor a SillyTavern completion preset).",

  // Native features
  "recast.disabled": "Recast is disabled.",
  "recast.presetNotFound": "Recast preset not found.",
  "comfy.disabled": "ComfyInject is disabled.",
  "comfy.hostNotConfigured": "No ComfyUI host is configured.",
  "director.disabled": "Image Director is disabled.",
  "director.noModel": "No model is configured for Image Director.",

  // Memoria Viva and NPC Tracker
  "memory.factNotFound": "Fact not found.",
  "memory.episodeNotFound": "Episode not found.",
  "memory.noRevision": "There is no memory revision to roll back to.",
  "npc.notFoundInChat": "That NPC is not tracked in this chat.",
  "npc.favoriteNotFound": "Favorite NPC not found.",

  // Providers
  "provider.unknown": "That provider is not one of the known ones.",
  "provider.apiKeyRequired": "The API key cannot be empty.",
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

/** Shape the routes send back: the canonical text, plus the code the interface translates. */
export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
}

export function apiErrorBody(code: ApiErrorCode): ApiErrorBody {
  return { error: API_ERRORS[code], code };
}
