export const settings = {
  language: {
    title: "Idioma",
    description:
      "Elegí el idioma de la interfaz. El cambio se aplica al instante y queda guardado en este navegador.",
    groupLabel: "Idioma de la interfaz",
    option: {
      es: "Toda la interfaz en español.",
      en: "Toda la interfaz en inglés.",
    },
    active: "Idioma activo",
  },
  /** Wording two screens of this namespace both show, defined once. */
  shared: {
    enabled: "Habilitado",
    none: "Ninguno",
  },
  themes: {
    title: "Temas",
    description:
      "Elegí la atmósfera de la interfaz. El cambio se aplica al instante y queda guardado en este navegador.",
    gridLabel: "Tema de la interfaz",
    /** One entry per theme id in `lib/themes.ts`. Ids are identifiers, not copy. */
    item: {
      gateton: {
        name: "Gateton",
        description: "Tinta, papel y rosa empolvado. El estilo original.",
      },
      medianoche: {
        name: "Medianoche",
        description: "Azules profundos con acentos de cielo nocturno.",
      },
      bosque: {
        name: "Bosque",
        description: "Verdes apagados, musgo y madera húmeda.",
      },
      vino: {
        name: "Vino",
        description: "Borgoña oscuro con detalles cálidos y teatrales.",
      },
      ambar: {
        name: "Ámbar",
        description: "Carbón cálido, cobre y luz de escritorio.",
      },
      papel: {
        name: "Papel",
        description: "Un modo claro, suave y editorial para leer de día.",
      },
    },
  },
  providers: {
    title: "Proveedor de IA",
    description:
      "El proveedor activo se usa para todas las generaciones (chat, Director, Recast, NPCs, memoria). Las API keys se guardan solo en el backend y nunca se devuelven al navegador.",
    loading: "Cargando proveedores…",
    loadFailed: "No se pudo cargar ningún proveedor.",
    /** Shown by `useProviders` when the provider list cannot be fetched. */
    fetchFailed: "No se pudieron cargar los proveedores",
    /** Shown by `useProviderModels` when one provider's model list cannot be fetched. */
    modelsFailed: "No se pudo traer la lista de modelos",
    active: "Proveedor activo",
    /** Technical field names, the same in both languages. */
    baseUrl: "Base URL",
    baseUrlDefault: "Default: {url}",
    baseUrlOverride: "Reemplaza al default ({url}). No incluyas /chat/completions.",
    saveBaseUrl: "Guardar Base URL",
    restoreDefault: "Restaurar default",
    apiKey: "API key",
    keyFromEnv: "Configurada desde el entorno ({hint}). Guardá una acá para reemplazarla.",
    keyStored: "Guardada ({hint}).",
    keyMissing: "Sin configurar — este proveedor la necesita.",
    keyOptional: "Opcional — este proveedor no requiere API key.",
    replaceKey: "Reemplazar key…",
    pasteKey: "Pegá la API key…",
    saveKey: "Guardar key",
    deleteKey: "Borrar key",
    test: "Probar conexión",
    testing: "Probando…",
    testReplied: 'Respondió: "{reply}"',
    unknownError: "Error desconocido",
    backendUnreachable: "No se pudo conectar con el backend.",
    testNote: "Probar conexión manda un mensaje real y corto a {provider} — puede consumir crédito.",
  },
  models: {
    sortAlpha: "Orden: alfabético",
    sortPrice: "Orden: más barato primero",
    sortContext: "Orden: más contexto primero",
    groupByVendor: "Agrupar por proveedor",
    searchPlaceholder: "Buscar modelo…",
    noResults: "Sin resultados. Escribí el ID del modelo.",
    enterToUse: "Enter para usar «{query}»",
    /** Compact metadata of a model row: only the word for a zero price is copy. */
    free: "Free",
    pricePerMillion: "${price}/1M tok",
    contextK: "{tokens}k ctx",
    contextTokens: "{tokens} ctx",
  },
  recast: {
    title: "Recast",
    description:
      "Pule la prosa del modelo después de generarla, con una cadena de pasadas (cada una con su propio prompt y modelo). Revisás el cambio en el chat y aceptás o rechazás.",
    presetMissing:
      "El preset activo de Recast ya no existe (fue borrado). Elegí uno nuevo acá abajo para que Recast vuelva a funcionar.",
    enabledNoPreset: "⚠️ Elegí un preset activo con pasadas.",
    enabledHint: "Corre después de cada respuesta del modelo.",
    /** Technical name of the option, the same in both languages. */
    autoRun: "Auto-run",
    autoRunHint:
      "Apagalo para que Recast NO corra solo: usá el botón 'Recast' en cada mensaje para pulir solo los que quieras.",
    activePreset: "Preset activo",
    activePresetHint: '{active} de {total} pasadas activas en "{name}".',
    activePresetEmpty: "Qué pipeline de pasadas usar para pulir el texto.",
    minChars: "Mínimo de caracteres para procesar",
    minCharsHint: "Mensajes más cortos que esto no pasan por Recast.",
    sceneContextAsRoles: "Mandar el historial como mensajes de rol separados",
    sceneContextAsRolesHint: "En vez de un solo bloque de texto plano.",
  },
  memory: {
    /** Module name: it reads the same in both languages, like Estudio or Lorebooks. */
    title: "Memoria Viva",
    description:
      "Cada chat compila un brief de continuidad —escena, canon con evidencia, hilos abiertos y quién sabe qué— y lo inyecta antes del historial. Aprende del turno en segundo plano, sin bloquear la respuesta.",
    experimental: "Experimental",
    mayFail: "Puede fallar",
    warning:
      "Es una feature nueva y en desarrollo. La extracción automática puede guardar cosas incorrectas, marcar pendientes de más o saltear momentos importantes. Está activada por chat y se puede apagar en cualquier momento desde su panel: al apagarla, la conversación funciona exactamente como antes.",
    whatYouRemember: "Qué recordás y dónde verlo",
    /** Each entry is a bold label plus the sentence that follows it in the list. */
    list: {
      now: {
        label: "Ahora:",
        text: "escena, momento, presentes y objetivo inmediato.",
      },
      canon: {
        label: "Canon:",
        text: "hechos con su evidencia y confianza.",
      },
      pending: {
        label: "Pendientes:",
        text: "promesas, secretos, amenazas y planes abiertos.",
      },
      whoKnows: {
        label: "Quién sabe qué:",
        text: "qué personaje conoce cada hecho.",
      },
      timeline: {
        label: "Línea temporal y Revisiones:",
        text: "qué cambió y cómo revertirlo.",
      },
      usedInTurn: {
        label: "Usado en turno:",
        text: "exactamente qué recibió el modelo y por qué.",
      },
    },
    perChat: {
      title: "Configuración por chat",
      /** The sentence is split around the bold "Ajustes" tab name. */
      bodyPrefix:
        "El modo de extracción, el modelo del extractor, los límites, el presupuesto del brief, la recuperación semántica, el alcance compartido y la deduplicación visual se ajustan en la pestaña",
      settingsTab: "Ajustes",
      bodySuffix: "del panel, porque cada conversación guarda su propia memoria.",
    },
    openPanel: "Abrir panel de memoria del chat",
    noChat:
      "Abrí un chat y vas a poder entrar al panel desde acá o desde el botón «Memoria» del encabezado.",
    auto: {
      title: "Cómo se activa por sí sola",
      before: "Antes de cada respuesta se compila el brief y se inyecta como memoria del turno.",
      after: "Después de cada respuesta se extraen hechos nuevos en segundo plano.",
      edits:
        "Si editás, borrás un mensaje o cambiás de variante, la memoria que citaba ese texto queda marcada para revisar.",
      guard: "El Continuity Guard avisa si una respuesta contradice el canon; nunca la reescribe solo.",
    },
  },
  stImport: {
    title: "Importar de SillyTavern",
    description:
      "Apuntá a tu instalación de SillyTavern en disco y elegí personajes, lorebooks, presets y personas para traer sin modificar los originales.",
    folder: "Carpeta de SillyTavern",
    folderHint: "La raíz de la instalación (la que contiene la carpeta data/), no la carpeta data en sí.",
    folderPlaceholder: "/home/usuario/SillyTavern",
    scan: "Escanear",
    scanning: "Escaneando…",
    scanError: "Error al escanear",
    user: "Usuario de SillyTavern",
    charactersTitle: "Personajes ({count})",
    searchCharacter: "Buscar personaje…",
    noResults: "Sin resultados.",
    lorebooksTitle: "Lorebooks ({count})",
    entryCount: "{count} entradas",
    noLorebooks: "No se encontraron lorebooks.",
    presetsTitle: "Presets de respuesta ({count})",
    noPresets: "No se encontraron presets.",
    personasTitle: "Personas ({count})",
    noPersonas: "No se encontraron personas.",
    selectAll: "Seleccionar todos",
    selectedCount: "{count} elegidos",
    apply: "Importar seleccionados ({count})",
    applying: "Importando…",
    applyError: "Error al importar",
    /** `{summary}` is the "12 personajes, 3 presets…" list built from the keys below. */
    imported: "Importado: {summary}.",
    importedWithErrors: "Importado: {summary}. {count} error(es): {errors}",
    importedCharacters: "{count} personajes",
    importedPresets: "{count} presets",
    importedPersonas: "{count} personas",
    importedLorebooks: "{count} lorebooks",
  },
  comfy: {
    title: "ComfyInject",
    description:
      "Genera imágenes en ComfyUI cuando el modelo escribe un marcador [[IMG:...]] en su respuesta.",
    enabledHint: "Si está apagado, los marcadores [[IMG:...]] se muestran como texto y no generan nada.",
    tabs: {
      general: "General",
      prompts: "Prompts & Sampler",
      tags: "Shot tags & LoRAs",
      locks: "Locks",
      presets: "Estilos",
      test: "Probar",
    },
    general: {
      host: "Host de ComfyUI",
      hostHint: "URL donde corre tu instancia de ComfyUI, ej. http://127.0.0.1:8188",
      checkpoint: "Checkpoint",
      checkpointHint: "El modelo base a usar. Empezá a tipear para ver sugerencias.",
      workflow: "Workflow",
      diffusionModel: "Diffusion model",
      diffusionModelHint:
        "El modelo DiT (UNETLoader) — para Krea 2 va en models/diffusion_models/. Empezá a tipear para ver sugerencias.",
      textEncoder: "Text encoder",
      textEncoderHint: "El encoder de texto (CLIPLoader) — para Krea 2 va en models/text_encoders/.",
      vae: "VAE",
      vaeHint: "El VAE (VAELoader) — para Krea 2 va en models/vae/.",
      maxPollAttempts: "Max poll attempts",
      maxPollAttemptsHint: "Cuántas veces reintenta consultar el resultado antes de darse por vencido.",
    },
    prompts: {
      baseTitle: "Prompt base",
      baseDescription: "Las instrucciones y prompts que se mandan al modelo y al generador.",
      directive: "Directiva para el modelo",
      directiveHint:
        "Es lo único de esta pantalla que el MODELO ve — le explica el formato [[IMG: tags | AR | SHOT | SEED]] para que sepa escribir marcadores. Se manda siempre que ComfyInject esté habilitado, sin importar qué preset de respuesta tengas activo. Por default usamos una directiva genérica generada con tus shot tags configurados; activá el switch para reemplazarla por la tuya (por ejemplo, si ya tenés reglas más detalladas de un preset de SillyTavern).",
      useCustomDirective: "Usar directiva propia",
      customDirectivePlaceholder:
        "Escribí acá las instrucciones que el modelo va a leer para generar marcadores [[IMG:...]].",
      enhancer: "Tag enhancer",
      enhancerHint:
        "Enriquece cada prompt antes de generar: elimina tags repetidas, agrega la quality ladder si falta y deriva la iluminación según el mood de la escena. Son reglas locales (sin LLM) y no modifican el workflow.",
      enhancePrompts: "Enriquecer prompts automáticamente",
      directorMode: "Director Mode",
      directorModeHint:
        "Cuando está activo, el modelo principal NO genera tags de imagen. Solo el Image Director (en Gateton-Roleplay) inserta los tags. ComfyInject sigue renderizándolos normalmente.",
      directorToggle: "Dejar que el Director maneje las imágenes",
      negativePrompt: "Negative prompt",
      negativePromptHint: "Lo que no querés que aparezca en la imagen.",
      prependPrompt: "Prepend prompt",
      prependPromptHint: "Se agrega al principio de cada prompt de imagen.",
      appendPrompt: "Append prompt",
      appendPromptHint: "Se agrega al final de cada prompt de imagen.",
    },
    sampler: {
      /** Also used as the label of the sampler field inside this section. */
      title: "Sampler",
      description: "Parámetros de generación de la imagen.",
      steps: "Steps",
      cfg: "CFG",
      denoise: "Denoise",
      scheduler: "Scheduler",
    },
    resolutions: {
      title: "Resoluciones",
      description: "Dimensiones por cada aspect ratio.",
      label: "Resoluciones por aspect ratio",
    },
    tags: {
      shotTags: "Shot tags",
      shotTagsHint:
        "Palabras clave de encuadre que el modelo puede usar dentro de [[IMG:...]] — cada una se traduce a este texto en el prompt final.",
      loras: "LoRAs",
      lorasHint:
        "Se aplican siempre que ComfyInject genera una imagen. El workflow elegido en General define cuántas realmente se usan (cada uno tiene un número fijo de nodos LoRA encadenados) — agregar más filas acá de las que el workflow soporta no hace nada.",
      name: "Nombre",
      removeRow: "Quitar esta fila",
      removeLora: "Quitar LoRA",
      empty: "No hay LoRAs configuradas.",
      add: "+ Agregar LoRA",
      /** Technical field names of the LoRA node inputs, the same in both languages. */
      strengthModel: "strength_model",
      strengthClip: "strength_clip",
    },
    locks: {
      intro:
        "Los locks fuerzan un valor fijo en vez de dejar que el modelo/el marcador lo decida — útil para mantener consistencia visual entre imágenes de una misma escena.",
      /** Names of the locks, the same in both languages. */
      resolution: "Resolution lock",
      shot: "Shot lock",
      seed: "Seed lock",
      /**
       * Values of `seed_lock_mode`. They are ComfyUI tokens that travel to the API, so they are not
       * translated: the label and the value are the same string on purpose.
       */
      seedMode: {
        random: "RANDOM",
        lock: "LOCK",
        custom: "CUSTOM",
      },
    },
    presets: {
      active: "Estilo activo",
      activeHint:
        "Al elegir uno, copia sus valores a Checkpoint/Sampler/LoRAs de las otras pestañas — lo que ves ahí es siempre lo que se va a generar. 'Ninguno' deja lo que tengas puesto vos.",
      none: "Ninguno (valores base)",
      saveTitle: "Guardar settings actuales como estilo",
      saveHint:
        "Toma lo que tenés en las otras pestañas (checkpoint, LoRAs, sampler, prompts) y lo guarda con un nombre. Si el nombre ya existe, lo sobreescribe.",
      namePlaceholder: "Nombre del estilo",
      empty: "Todavía no hay estilos guardados.",
      editTitle:
        "Editar (carga sus valores en las otras pestañas — al Guardar con el mismo nombre, lo actualiza)",
      editStyle: "Editar estilo",
      deleteStyle: "Borrar estilo",
    },
    test: {
      intro:
        'Genera una imagen directa, sin pasar por ningún chat — usa la MISMA función de generación real, así que si tenés un "Estilo activo" en Presets, se va a aplicar acá también, exactamente como en un chat de verdad.',
      prompt: "Prompt (tags)",
      promptPlaceholder: "1girl, silver hair, violet eyes, smiling…",
      /** Short labels of the generation parameters. */
      ar: "AR",
      shot: "Shot",
      seed: "Seed (vacío = random)",
      /** The token ComfyUI uses for a random seed, kept as it is. */
      seedPlaceholder: "RANDOM",
      customResolution: "Resolución custom (opcional)",
      customResolutionHint:
        "Si completás ambos, se usa esta resolución exacta en vez de la configurada para el AR elegido (y también ignora el resolution lock, si tenés uno).",
      width: "ancho",
      height: "alto",
      clear: "limpiar",
      generate: "Generar",
      generating: "Generando…",
      error: "Error al generar",
      resultAlt: "Resultado de prueba",
      usedTitle: "Lo que se usó de verdad",
      activePreset: "Estilo activo:",
      checkpoint: "Checkpoint:",
      samplerScheduler: "Sampler / Scheduler:",
      loras: "LoRAs:",
      seedLabel: "Seed:",
      arShot: "AR / Shot:",
      resolution: "Resolución:",
      finalPrompt: "Prompt final",
    },
  },
};
