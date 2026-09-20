/**
 * The chat itself: composer, message bubbles, swipe/edit actions, chat-level modals.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 *
 * Module names (Recast, Image Director, NPC Tracker, Lorebook, Persona) are the name of the
 * feature, so they read the same in both languages. "Memoria Viva" is kept as-is for the same
 * reason. Event pills keep their leading icon (the emoji is an icon, not decoration), so the pill
 * looks the same in either language.
 */
export const chat = {
  /** First screen when no chat is open. */
  empty: {
    kicker: "Tu espacio narrativo",
    title: "Una historia está esperando.",
    body: "Elegí un personaje de tu biblioteca o abrí uno de tus chats recientes para volver a la escena.",
  },
  /** The message thread: its empty state, the NPC filter banner and the stream error line. */
  thread: {
    emptyTitle: "La escena está en silencio.",
    emptyBody: "Escribí el primer mensaje. No hace falta que sea perfecto, solo que abra una puerta.",
    /** Wraps the `@Name` span: the name is rendered as its own element between both halves. */
    filterPrefix: "Mostrando solo apariciones de ",
    filterSuffix: " ({count})",
    clearFilter: "Quitar filtro",
    errorLabel: "Error: {message}",
  },
  /** Chat header: identity line and the buttons on the right. */
  header: {
    noCharacter: "Chat sin personaje",
    activeScene: "Escena activa",
    editCharacter: "Editar personaje",
    editCharacterNamed: "Editar a {name}",
    memory: "Memoria",
    memoryHint: "Memoria Viva: canon, hilos abiertos y lo que recuerda el modelo",
    memoryHintExperimental:
      "Memoria Viva (experimental, puede fallar): canon, hilos abiertos y lo que recuerda el modelo",
    /** Tiny badge next to "Memoria" while the feature is experimental. */
    experimentalBadge: "exp",
    experimentalHint: "Feature experimental: puede fallar",
    npcs: "NPCs",
    npcRosterHint: "Elenco de NPCs de este chat",
    visualState: "Estado",
    visualStateHint: "Estado visual persistente del Director",
  },
  /** Composer bar: mode buttons, NPC reaction picker, placeholder, send/stop. */
  composer: {
    impersonate: "Como {name}",
    impersonateHint:
      "Escribí como si fueras el personaje — se envía como respuesta suya y la IA continúa desde ahí.",
    snapshot: "Instantánea",
    snapshotHint: "Generar una imagen de lo que está haciendo un NPC ahora mismo",
    snapshotDescription:
      "Genera una imagen de lo que está haciendo un NPC en este mismo instante de la escena, reaccionando al último mensaje. Elegí a quién:",
    noNpcs: "Este chat todavía no tiene NPCs trackeados",
    noNpcMatch: "Ningún NPC coincide",
    noNpcMatchHint: "Activá y escaneá el NPC Tracker para poder usar /img",
    /** Marks the roster's main character inside the reaction picker. */
    mainCharacterTag: "(CHAR)",
    directorGeneratingImage: "El Director está generando la imagen de reacción…",
    directorAnalyzing: "El Director está analizando el último mensaje…",
    placeholder:
      "Escribí tu mensaje... (Enter para enviar, Shift+Enter para salto de línea, @ para mencionar un NPC, / para comandos)",
    placeholderImpersonate:
      "Escribí como {name}… (Enter para enviar, Shift+Enter para salto de línea)",
    send: "Enviar",
    stop: "Detener",
  },
  /** Fallback speaker names, used when the persona or the character card has no name of its own. */
  speaker: {
    user: "Vos",
    assistant: "Asistente",
    /** Mid-sentence: "Como personaje". */
    characterFallback: "personaje",
    /** Title case, as a window title. */
    characterFallbackCapitalized: "Personaje",
    /** After a preposition: "Escribí como el personaje". */
    characterFallbackDefinite: "el personaje",
  },
  /** Per-message action row and the swipe navigation around it. */
  message: {
    edit: "Editar",
    copy: "Copiar",
    copyText: "Copiar texto",
    copyRaw: "Copiar raw",
    copyRawHint: "Copiar texto crudo (sin resolver macros)",
    quote: "Citar",
    quoteHint: "Insertar el texto crudo en el composer",
    delete: "Borrar",
    regenerate: "Regenerar",
    continue: "Continuar",
    continueHint: "Seguir escribiendo desde donde se cortó",
    previousVersion: "Versión anterior",
    nextVersion: "Versión siguiente",
    polishing: "Puliendo texto…",
    insertingTags: "Insertando tags de imagen…",
    recast: "Recast",
    runRecastHint: "Correr Recast en este mensaje",
    director: "Director",
    runDirectorHint: "Ejecutar Image Director en este mensaje",
    viewDiff: "Ver diff",
    viewDiffHint: "Ver / revertir el diff de Recast",
  },
  /** Slash commands offered by the composer's autocomplete and listed in the help menu. */
  commands: {
    img: {
      args: "NombreNPC",
      description: "El Director genera una imagen de ese NPC reaccionando al último mensaje",
    },
  },
  /** Generated images inside a message: markers, retry buttons and the tag lightbox. */
  image: {
    generating: "[Generando imagen…]",
    generate: "Generar imagen",
    regenerating: "Regenerando…",
    regenerate: "Regenerar imagen",
    retrying: "Reintentando…",
    retry: "Reintentar",
    viewLarge: "Ver grande + tags",
    viewLargeAvatar: "Ver avatar grande",
    invalidMarker: "Marcador de imagen inválido: {reason}",
    failed: "No se pudo generar la imagen: {reason}",
    lightboxTitle: "Imagen generada",
    tags: "Tags (prompt):",
    tagCount: "{count} tags",
    minTags: "(mín. {count})",
    /** Token names are ComfyUI's own, so they read the same in both languages. */
    seedLine: "Seed: {seed} · AR: {ar} · Shot: {shot}",
    model: "Modelo:",
    loras: "LoRAs:",
  },
  /**
   * Collapsible "model thinking" block above a reply. The leading emoji is the block's icon, so
   * it travels with the copy and stays visible in both languages.
   */
  reasoning: {
    title: "💭 Pensamiento del modelo",
  },
  /** The "Vista" menu in the chat header. */
  options: {
    menuTitle: "Opciones de la vista y de este chat",
    view: "Vista",
    fontSize: "Letra",
    images: "Imágenes",
    density: "Densidad",
    densityComfortable: "Cómodo",
    densityCompact: "Compacto",
    stepDown: "Menos",
    stepUp: "Más",
    persona: "Persona",
    personaHint: "Quién sos vos en esta historia",
    personaNone: "Ninguna",
    lorebook: "Lorebook",
    lorebookLabel: "Lorebook del chat",
    lorebookHint: "Lorebook exclusivo de este chat",
    lorebookGlobal: "Lore global/character",
    openLoreInspector: "Ver el lore activo en este turno",
    openGallery: "Galería de imágenes del chat",
  },
  /** Per-chat {{placeholders}}: the modal, its example and its placeholders. */
  variables: {
    title: "Variables del chat",
    /** Split around the `<code>` examples in the middle of the sentence. */
    hint: {
      prefix: "Definí placeholders (ej. ",
      middle: ") y usalos en tus prompts como ",
      suffix: ". Se reemplazan en vivo cada turno.",
    },
    /** Sample variable names and values that "Cargar ejemplo" fills in. */
    example: {
      weatherName: "clima",
      weatherValue: "lluvia torrencial",
      locationName: "ubicacion",
      locationValue: "callejón oscuro del puerto",
      timeName: "hora",
      timeValue: "medianoche",
    },
    empty: "Sin variables definidas.",
    keyPlaceholder: "nombre",
    valuePlaceholder: "valor",
    remove: "Quitar",
    add: "Agregar",
    loadExample: "Cargar ejemplo",
    loadExampleHint: "Llenar con un ejemplo ({weather}, {location}, {time})",
  },
  /** Grid of every image generated in the chat. */
  gallery: {
    title: "Galería del chat",
    empty: "No hay imágenes generadas en este chat todavía.",
  },
  /** Recast's diff view: one tab per pass plus the full diff. */
  recast: {
    title: "Recast — revisar cambios",
    fullDiff: "Full diff",
    fullDiffHint: "Original → Final",
    pass: "Pasada {index}",
    original: "Original",
    transformed: "Transformado",
    transformedEditable: "Transformado (editable)",
    accept: "Aceptar",
    reject: "Rechazar",
    editHint: "Podés editar el texto de la derecha antes de aceptar.",
  },
  /** Pills under a message that record what happened that turn. */
  turnEvent: {
    title: {
      npcAdded: "Nuevo NPC",
      npcEvolved: "NPC evolucionó",
      visualState: "Cambio de estado visual",
    },
    empty: "No hay detalle disponible para este evento.",
    viewChanges: "Ver qué cambió",
  },
  /** "Lore activo en este turno" inspector, including its token budget summary. */
  loreInspector: {
    title: "Lore activo en este turno",
    scanning: "Escaneando contexto…",
    usedTokens: "tokens usados",
    budget: "presupuesto",
    activated: "activadas",
    overflow: "El presupuesto se completó; algunas entradas quedaron fuera.",
    entry: "Entrada {uid}",
    noLorebooks: "No hay lorebooks asociados a este contexto.",
    failed: "No se pudo inspeccionar el lore.",
  },
  npcRoster: {
    title: "Elenco de NPCs",
  },
  visualState: {
    title: "Estado visual persistente",
  },
  /** Memoria Viva badge and its panel title. */
  memory: {
    title: "Memoria Viva · experimental",
    /** Screen-reader label of the badge, spelling out the three counters. */
    badgeLabel: "Memoria Viva: {facts} hechos, {threads} tramas",
    badgeLabelReview: ", {count} a revisar",
    badgeTitle: "Memoria Viva",
    openBadge: "Abrir Memoria Viva",
    facts: "hechos",
    threads: "tramas",
    needsReview: "a revisar",
    /** Reason recorded on the ledger when a change makes cited evidence unverifiable. */
    invalidation: {
      edited: "mensaje editado",
      deleted: "mensaje eliminado",
      swipe: "swipe cambiado",
    },
  },
  /** Image Director: per-message actions, diagnostics and the errors it can surface. */
  director: {
    /** Used as the label of the timeout wrapper; it is the module's own name. */
    moduleName: "Image Director",
    reactionLabel: "Director (reacción)",
    viewResponse: "Ver respuesta del Director",
    diagnosticsTitle: "Diagnóstico del Director",
    receivedResponse: "Respuesta recibida",
    emptyResponse: "(respuesta vacía)",
    modelReasoning: "Razonamiento del modelo",
    noReasoning: "Este modelo/proveedor no devolvió razonamiento visible.",
    /** One line of the visual-state history: the field name is "outfit" in both languages. */
    historyOutfit: "outfit → {outfit}",
    change: {
      outfit: "Outfit",
      stateAdded: "Estado agregado",
      stateRemoved: "Estado quitado",
      noneBefore: "(sin registro)",
    },
    error: {
      disabled: "El Director está deshabilitado.",
      noModel: "No hay modelo configurado para el Director.",
      timeout: "El Director tardó demasiado en responder.",
      reasoningMandatory: "Este modelo exige razonamiento: cambiá 'Thinking effort' a auto o low (no off).",
      openRouterFailed: "El Director falló (OpenRouter): {message}",
      failed: "El Director falló: {message}",
      noImageInserted: "El Director no insertó ninguna imagen.",
    },
    stateCheck: {
      updated: "{count} personaje(s) actualizado(s).",
      noChanges: "Sin cambios — el estado ya era preciso.",
      failed: "Error al revisar el estado visual.",
    },
  },
  /** Turn-event pills. The leading emoji is the pill's icon, so it stays in both languages. */
  events: {
    npcAdded: "🆕 Nuevo NPC: {name}",
    npcEvolvedOne: "✨ {name} evolucionó (1 campo)",
    npcEvolvedMany: "✨ {name} evolucionó ({count} campos)",
    visualState: "👗 {character}: {summary}",
  },
  /** Continuity Guard: the notice under a reply and its findings modal. */
  guard: {
    title: "Continuidad de la memoria",
    description: "La guardia de continuidad comparó esta respuesta con lo que Memoria Viva tiene registrado.",
    conflict: "Posible choque con la memoria: {reason}",
    moreFindings: " (+{count} más)",
    viewDetails: "Ver detalles",
    dismiss: "Descartar",
    severityHigh: "Grave",
    severityMedium: "Media",
    severityLow: "Leve",
  },
  /** Failures from the chat stream and from the NPC reaction flow. */
  errors: {
    backendUnreachable: "No se pudo conectar con el backend.",
    unknown: "Error desconocido",
    npcNotFound: 'No encontré a "{name}" en el roster de NPCs de este chat.',
    reactionImageFailed: "No se pudo generar la imagen de reacción.",
  },
};
