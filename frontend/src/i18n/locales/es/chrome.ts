/**
 * App shell: top bar, side panels, overlays, shared UI primitives, error boundary.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const chrome = {
  brand: {
    tagline: "laboratorio de historias",
  },
  topbar: {
    mainNav: "Herramientas principales",
    openResponsePanel: "Abrir panel de respuesta",
    openLibrary: "Abrir biblioteca",
    moreTools: "Más herramientas",
    help: "Ayuda",
  },
  /** Top-bar buttons. Short: they sit next to each other on one row. */
  feature: {
    presets: "Presets",
    personas: "Personas",
    lorebooks: "Lorebooks",
    characterCreator: "Crear personaje",
    director: "Director",
    estudio: "Estudio",
    gatetonRp: "Gateton RP",
    comfyInject: "ComfyInject",
    usage: "Uso",
    recast: "Recast",
    npcs: "NPCs",
    importSt: "Importar ST",
    settings: "Configuración",
  },
  /** Full-screen panel titles. Some are the product name of a module and stay in both languages. */
  modal: {
    presets: "Presets de respuesta",
    estudio: "Estudio",
    gatetonRoleplay: "Gateton-Roleplay",
    npc: "NPC Tracker",
    comfyInject: "ComfyInject",
    usage: "Uso y costos",
    recast: "Recast",
    importSt: "Importar desde SillyTavern",
    settings: "Configuración",
    personas: "Personas",
    characterCreator: "Character Creator",
    director: "Image Director",
    lorebooks: "Lorebooks",
  },
  panel: {
    hide: "Ocultar panel",
    showResponse: "Mostrar Respuesta",
    showCharacters: "Mostrar Personajes",
  },
  tabs: {
    response: "Respuesta",
  },
  error: {
    title: "Algo falló",
    reload: "Recargar",
  },
  library: {
    title: "Biblioteca",
    characters: "Personajes",
    newCharacter: "Nuevo personaje",
    searchCharacter: "Buscar personaje…",
    favoritesOnly: "Mostrar solo favoritos",
    favorites: "Favoritos",
    clearFilters: "Limpiar filtros",
    clear: "Limpiar",
    new: "Nuevo",
    importPng: "Importar PNG",
    importJson: "Importar JSON",
    noCharacters: "Sin personajes. Creá o importá uno.",
    addFavorite: "Agregar a favoritos",
    removeFavorite: "Quitar de favoritos",
    favorite: "Favorito",
    newChat: "Nuevo chat",
    editCharacter: "Editar personaje",
    deleteCharacter: "Borrar personaje",
    noChatsForCharacter: "Sin chats — tocá + para empezar.",
    noTitle: "(sin título)",
    rename: "Renombrar",
    deleteChat: "Borrar chat",
    recentChats: "Últimos chats",
    noChats: "Sin chats todavía.",
    personas: "Personas",
    noPersonas: "Sin personas.",
    defaultBadge: "por defecto",
    managePersonas: "Gestionar personas →",
    /** Format acronyms: the same word in both languages. */
    png: "PNG",
    json: "JSON",
    deleteCharacterConfirm: "¿Borrar a {name}? Los chats con este personaje se mantendrán, pero quedarán sin personaje.",
  },
  /** Shared UI primitives: the caller passes `label` already translated. */
  slider: {
    ariaLabel: "{label} slider",
    notSet: "(sin definir)",
  },
};
