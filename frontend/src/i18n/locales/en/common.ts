/**
 * English catalog. Same keys as the Spanish one, same structure, different values. Written as
 * neutral international English, not a literal translation of the Spanish.
 */
export const common = {
  appName: "Pliego Lab",
  /** Shown after the app name in the browser tab title. */
  tagline: "A local workspace for interactive storytelling.",
  actions: {
    close: "Close",
    save: "Save",
    cancel: "Cancel",
  },
  /**
   * Messages the backend sends with a stable code (see backend/src/services/apiError.ts).
   * The key is the code, so `common.errors.<code>` is the rule on both sides.
   */
  errors: {
    "st.pathRequired": "Set the SillyTavern folder in Settings first.",
    "st.notAnInstall": "That does not look like a SillyTavern installation (no data/<user> folder).",
    "st.noUser": "No SillyTavern user was found in that folder.",
    "usage.openRouterOnly": "Usage and cost is only available with OpenRouter as the active provider.",
    "character.notFound": "Character not found.",
    "character.noName": "The character card has no name.",
    "character.pngRequired": "A PNG file is required.",
    "character.invalidJson": "The character JSON is not valid.",
    "character.noGreeting": "This character has no greeting to translate.",
    "lorebook.notFound": "Lorebook not found.",
    "lorebook.nameRequired": "The lorebook needs a name.",
    "lorebook.invalidFile": "The file does not contain a valid lorebook.",
    "lorebook.invalidJsonFile": "The JSON file is not valid.",
    "chat.notFound": "Chat not found.",
    "persona.notFound": "Persona not found.",
    "preset.notFound": "Sampling preset not found.",
    "preset.importInvalid": "The file does not contain a valid preset (neither a Pliego preset nor a SillyTavern completion preset).",
    "recast.disabled": "Recast is disabled.",
    "recast.presetNotFound": "Recast preset not found.",
    "comfy.disabled": "ComfyInject is disabled.",
    "comfy.hostNotConfigured": "No ComfyUI host is configured.",
    "director.disabled": "Image Director is disabled.",
    "director.noModel": "No model is configured for Image Director.",
    "memory.factNotFound": "Fact not found.",
    "memory.episodeNotFound": "Episode not found.",
    "memory.noRevision": "There is no memory revision to roll back to.",
    "npc.notFoundInChat": "That NPC is not tracked in this chat.",
    "npc.favoriteNotFound": "Favorite NPC not found.",
    "provider.unknown": "That provider is not one of the known ones.",
    "provider.apiKeyRequired": "The API key cannot be empty.",
  },
  state: {
    loading: "Loading…",
  },
};
