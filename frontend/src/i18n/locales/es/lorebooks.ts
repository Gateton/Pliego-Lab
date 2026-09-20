/**
 * Lorebooks: entries, activation, editor.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const lorebooks = {
  title: "Lorebooks",
  subtitle: "El conocimiento vivo de tus mundos. Compatible con World Info de SillyTavern.",
  emptySelection: "Elegí o creá un lorebook para comenzar.",
  /** Default memo of a new entry: it seeds the entry data, and the user can edit it. */
  newEntryMemo: "Nueva entrada",
  /**
   * Labels and words shown by more than one part of the studio: the engine settings and the
   * per-entry advanced panel, the entry list and the book overview, and the character editor.
   */
  shared: {
    scanDepth: "Profundidad de escaneo",
    alwaysActive: "Siempre activa",
    entry: "entrada",
    entries: "entradas",
  },
  /** Actions of this screen that are not shared with another one. */
  action: {
    duplicateName: "{name} — copia",
    duplicate: "Duplicar",
  },
  toolbar: {
    settings: "Ajustes",
    importSt: "Importar ST",
    newBook: "Nuevo lorebook",
  },
  saveState: {
    saved: "Guardado",
    auto: "Cambios automáticos",
  },
  settings: {
    heading: "Ajustes del motor",
    description: "Los libros importados mantienen el comportamiento de ST. Las fuentes nativas son opt-in.",
    activation: "Activación",
    engine: "Motor de lorebooks",
    engineHint: "Desactivarlo devuelve el prompt al comportamiento anterior.",
    recursive: "Escaneo recursivo",
    wholeWords: "Palabras completas por defecto",
    caseSensitive: "Distinguir mayúsculas por defecto",
    budget: "Presupuesto",
    budgetPercent: "Presupuesto del contexto (%)",
    budgetCap: "Límite absoluto de tokens",
    budgetCapHint: "0 significa sin límite adicional.",
    sgContext: "Contexto de Pliego Lab",
    npcBank: "Leer NPC Bank",
    npcBankHint: "Permite activar entradas desde dossiers. Solo lectura; no modifica NPC Tracker.",
    visualState: "Leer estado visual",
    visualStateHint: "Usa outfit y condiciones persistentes como contexto de activación.",
    includeNames: "Incluir nombres al escanear chat",
  },
  library: {
    heading: "Biblioteca",
    create: "Crear lorebook",
    searchPlaceholder: "Buscar mundos…",
    noMatches: "No encontramos ese mundo.",
    empty: "Tu biblioteca está lista para su primer mundo.",
    clearSearch: "Limpiar búsqueda",
    globalBadge: "Global",
  },
  entries: {
    heading: "Entradas",
    create: "Crear entrada",
    searchPlaceholder: "Memo, keyword, contenido…",
    untitled: "Entrada {uid}",
    noKeywords: "Sin keywords",
    empty: "Este libro todavía no tiene entradas.",
    createFirst: "Crear la primera",
  },
  editor: {
    /** Field name of the World Info format: the same in both languages. */
    uid: "UID",
    statusDisabled: "Deshabilitada",
    statusConstant: "Constante",
    statusKeywords: "Por keywords",
    /** Appended to the memo when an entry is duplicated. */
    copySuffix: "copia",
    removeKeyword: "Quitar keyword",
    memo: "Memo",
    memoHint: "Un nombre para encontrar esta entrada. No se envía al modelo.",
    active: "Activa",
    primaryKeywords: "Keywords primarias",
    keywordsHint: "Enter o coma para agregar. Click en una keyword para quitarla.",
    keywordPlaceholder: "dragón, reino, /regex/i…",
    secondaryKeywords: "Keywords secundarias",
    secondaryKeywordPlaceholder: "Condición adicional…",
    content: "Contenido",
    contentHint: "Se inserta en el prompt cuando la entrada se activa. Admite macros como {{char}}, {{user}}, {{npc_bank}} y {{visual_state}}.",
    position: "Posición",
    order: "Orden",
    orderHint: "Mayor se evalúa antes.",
    probability: "Probabilidad",
    advanced: "Configuración avanzada",
    depth: "Profundidad de inyección",
    scanDepthHint: "Vacío usa el valor global.",
    inclusionGroup: "Grupo de inclusión",
    groupWeight: "Peso del grupo",
    sticky: "Sticky (mensajes)",
    cooldown: "Cooldown (mensajes)",
    ignoreBudget: "Ignorar presupuesto",
    preventRecursion: "No disparar recursión",
    excludeRecursion: "Excluir de recursión",
    groupOverride: "Prioridad de grupo",
    scanDescription: "Escanear descripción del personaje",
    scanPersonality: "Escanear personalidad",
    scanScenario: "Escanear escenario",
    scanPersona: "Escanear persona",
    vectorized: "Esta entrada está marcada como vectorizada. El campo se conserva para compatibilidad, pero Pliego Lab no ejecuta embeddings.",
  },
  /** SillyTavern insertion positions, in the order the format defines them. */
  position: {
    beforeChar: "Antes del personaje",
    afterChar: "Después del personaje",
    authorNoteTop: "Author's Note · arriba",
    authorNoteBottom: "Author's Note · abajo",
    atDepth: "A profundidad",
    examplesTop: "Ejemplos · arriba",
    examplesBottom: "Ejemplos · abajo",
    outlet: "Outlet",
  },
  /** Selective logic operators of the World Info format: the tokens are the same in both languages. */
  logic: {
    andAny: "AND ANY",
    andAll: "AND ALL",
    notAny: "NOT ANY",
    notAll: "NOT ALL",
  },
  book: {
    nameAria: "Nombre del lorebook",
    descriptionPlaceholder: "¿Qué conocimiento guarda este mundo?",
    activeCount: "activas",
    constantCount: "constantes",
    globalOn: "Activo globalmente",
    globalOff: "Activar globalmente",
    exportSt: "Exportar para ST",
    guideTitle: "Construí el mundo entrada por entrada",
    guideText: "Seleccioná “+” en la columna central. Usá constantes para reglas permanentes y keywords para revelar conocimiento cuando la historia lo necesite.",
  },
  newBook: {
    promptTitle: "Nombre del nuevo lorebook",
    defaultName: "Nuevo mundo",
  },
  confirm: {
    deleteBook: "¿Borrar “{name}”? Las asociaciones dejarán de usarlo.",
    deleteEntry: "¿Borrar la entrada “{name}”?",
  },
  error: {
    openLibrary: "No se pudo abrir la biblioteca",
    save: "No se pudo guardar",
    settings: "No se pudo guardar la configuración",
    import: "No se pudo importar",
    delete: "No se pudo borrar el lorebook",
  },
};
