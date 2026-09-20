/**
 * Shared vocabulary: anything used by more than one screen lives here instead of being duplicated,
 * so one wording change reaches every place at once.
 */
export const common = {
  appName: "Pliego Lab",
  /** Shown after the app name in the browser tab title. */
  tagline: "Un espacio local para el rol y las historias interactivas.",
  actions: {
    close: "Cerrar",
    save: "Guardar",
    cancel: "Cancelar",
  },
  /**
   * Messages the backend sends with a stable code (see backend/src/services/apiError.ts).
   * The key is the code, so `common.errors.<code>` is the rule on both sides.
   */
  errors: {
    "st.pathRequired": "Configurá primero la ruta de SillyTavern",
    "st.notAnInstall": "No parece ser una instalación de SillyTavern válida (no se encontró data/<usuario>)",
    "st.noUser": "No se encontró ningún usuario de SillyTavern en esa ruta",
    "usage.openRouterOnly": "Uso y costos está disponible solo con OpenRouter como proveedor activo.",
    "character.notFound": "No se encontró el personaje.",
    "character.noName": "La card del personaje no tiene nombre.",
    "character.pngRequired": "Se necesita un archivo PNG.",
    "character.invalidJson": "El JSON del personaje no es válido.",
    "character.noGreeting": "Este personaje no tiene greeting para traducir.",
    "lorebook.notFound": "No se encontró el lorebook.",
    "lorebook.nameRequired": "El lorebook necesita un nombre",
    "lorebook.invalidFile": "El archivo no contiene un lorebook válido",
    "lorebook.invalidJsonFile": "El archivo JSON no es válido",
    "chat.notFound": "No se encontró el chat.",
    "persona.notFound": "No se encontró la persona.",
    "preset.notFound": "No se encontró el preset de respuesta.",
    "recast.disabled": "Recast está deshabilitado.",
    "recast.presetNotFound": "No se encontró el preset de Recast.",
    "comfy.disabled": "ComfyInject está deshabilitado.",
    "comfy.hostNotConfigured": "No hay comfy_host configurado",
    "director.disabled": "Image Director está deshabilitado.",
    "director.noModel": "No hay modelo configurado para Image Director.",
    "memory.factNotFound": "No se encontró el hecho.",
    "memory.episodeNotFound": "No se encontró el episodio.",
    "memory.noRevision": "No hay una revisión de memoria a la que volver.",
    "npc.notFoundInChat": "Ese NPC no está registrado en este chat.",
    "npc.favoriteNotFound": "No se encontró el NPC favorito.",
    "provider.unknown": "Ese proveedor no es uno de los conocidos.",
    "provider.apiKeyRequired": "La API key no puede estar vacía.",
  },
  state: {
    loading: "Cargando…",
  },
};
