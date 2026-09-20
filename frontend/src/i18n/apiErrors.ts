import type { TranslationKey } from "./index.ts";

/**
 * Backend error code → translation key. The codes are the ones in
 * `backend/src/services/apiError.ts`, and the key is always `common.errors.<code>`, so the mapping
 * reads as a list of the errors the interface knows how to explain.
 *
 * A code with no entry is not a bug on its own: the API client falls back to the canonical text the
 * backend sent. `npm run i18n:check` fails when these two lists drift apart, so a new code cannot
 * be forgotten silently.
 */
export const API_ERROR_KEYS: Record<string, TranslationKey> = {
  "st.pathRequired": "common.errors.st.pathRequired",
  "st.notAnInstall": "common.errors.st.notAnInstall",
  "st.noUser": "common.errors.st.noUser",
  "usage.openRouterOnly": "common.errors.usage.openRouterOnly",
  "character.notFound": "common.errors.character.notFound",
  "character.noName": "common.errors.character.noName",
  "character.pngRequired": "common.errors.character.pngRequired",
  "character.invalidJson": "common.errors.character.invalidJson",
  "character.noGreeting": "common.errors.character.noGreeting",
  "lorebook.notFound": "common.errors.lorebook.notFound",
  "lorebook.nameRequired": "common.errors.lorebook.nameRequired",
  "lorebook.invalidFile": "common.errors.lorebook.invalidFile",
  "lorebook.invalidJsonFile": "common.errors.lorebook.invalidJsonFile",
  "chat.notFound": "common.errors.chat.notFound",
  "persona.notFound": "common.errors.persona.notFound",
  "preset.notFound": "common.errors.preset.notFound",
  "recast.disabled": "common.errors.recast.disabled",
  "recast.presetNotFound": "common.errors.recast.presetNotFound",
  "comfy.disabled": "common.errors.comfy.disabled",
  "comfy.hostNotConfigured": "common.errors.comfy.hostNotConfigured",
  "director.disabled": "common.errors.director.disabled",
  "director.noModel": "common.errors.director.noModel",
  "memory.factNotFound": "common.errors.memory.factNotFound",
  "memory.episodeNotFound": "common.errors.memory.episodeNotFound",
  "memory.noRevision": "common.errors.memory.noRevision",
  "npc.notFoundInChat": "common.errors.npc.notFoundInChat",
  "npc.favoriteNotFound": "common.errors.npc.favoriteNotFound",
  "provider.unknown": "common.errors.provider.unknown",
  "provider.apiKeyRequired": "common.errors.provider.apiKeyRequired",
};
