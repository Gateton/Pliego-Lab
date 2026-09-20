/**
 * Response presets, sampling parameters, prompt blocks and the response panel.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const presets = {
  /** Labels that the response-preset manager and the Recast-preset manager both show. */
  shared: {
    activePreset: "Preset activo",
    presetName: "Nombre del preset",
    newPreset: "Nuevo preset",
    savePreset: "Guardar preset",
    model: "Modelo",
    editPreset: "Editar preset",
    edit: "Editar",
    deletePreset: "Borrar preset",
    delete: "Borrar",
  },
  /** Response panel (left column): active preset, output language, toggles and the prompt blocks. */
  panel: {
    activePresetHint: "Modelo: {model}",
    /** Shown as the model when the active preset does not pin one. */
    defaultModelFallback: "modelo por defecto del proveedor",
    noPresetOption: "Ninguno (defaults de la app)",
    editPresets: "Editar presets y parámetros →",
    outputLanguage: {
      label: "Idioma de salida",
      hint: "Fuerza al modelo a escribir siempre en este idioma, sin importar el preset ni Roleplay.",
      auto: "Sin forzar (auto)",
    },
    contextSize: {
      // The Spanish UI already ships this label in English, so it stays as it was.
      label: "Context Size (tokens)",
      activeHint: "{tokens} tokens — ventana de contexto por turno (del preset activo).",
      noPresetHint: "Sin preset activo — elegí uno en Presets para ajustar el contexto.",
    },
    streaming: {
      label: "Streaming",
      hint: "Muestra la respuesta mientras se genera.",
    },
    coloredDialogue: {
      label: "Diálogo coloreado",
      hint: "Pide al modelo un color fijo para cada personaje.",
    },
    blocks: {
      withPreset: "Bloques — {name}",
      global: "Bloques globales",
      add: "+ Agregar",
      emptyWithPreset: "Este preset no tiene prompts.",
      emptyGlobal: "Sin prompts. Agregá uno o usá Roleplay.",
      depth: "Profundidad",
      contentPlaceholder: "Escribí el contenido del bloque...",
      /** Where a prompt block goes. Technical names: the same value in both languages. */
      position: {
        system: "System",
        top: "Top",
        inChat: "In-chat",
        postHistory: "Post-history",
      },
      /** Role the block is sent as. This one is interface copy and is translated. */
      role: {
        system: "Sistema",
        user: "Usuario",
        assistant: "Asistente",
      },
      /** Name a freshly added block starts with. `system` stays untranslated; it is a technical name. */
      defaultName: {
        system: "System prompt",
        top: "Pre-chat",
        inChat: "Contexto",
        postHistory: "Jailbreak",
      },
    },
  },
  /** Response-preset manager: the list of presets and the preset form. */
  manager: {
    title: "Presets de respuesta",
    description:
      "Un preset define cómo responde el modelo: modelo, sampling, razonamiento, contexto y compatibilidad. El proveedor y sus credenciales son globales (pestaña Proveedor). Los prompts de cada preset se editan en el panel Respuesta (izquierda).",
    activePresetHint: "El que se usa para generar respuestas ahora mismo.",
    noPresetsOption: "(sin presets)",
    empty: "Todavía no creaste ningún preset.",
    providerModelFallback: "modelo del proveedor",
    promptCount: "{count} prompts",
    noPrompts: "sin prompts",
    modelHint: "Vacío = modelo por defecto del proveedor activo.",
    modelPlaceholder: "Modelo del proveedor…",
    capabilitiesNotice: "Mostrando solo los parámetros que {provider} declara soportar.",
    tabs: {
      sampling: "Sampling",
      reasoning: "Reasoning",
      context: "Contexto y compat",
      connection: "Proveedor",
    },
  },
  /** Sampling parameters plus the reasoning and context switches of a preset. */
  sampling: {
    /** The same option appears in both the reasoning-effort and the middle-out picker. */
    auto: "Auto",
    effort: {
      low: "Bajo",
      medium: "Medio",
      high: "Alto",
    },
    fields: {
      temperature: {
        label: "Temperature",
        hint: "Qué tan creativo/aleatorio es. Más alto = más variado, más bajo = más predecible.",
      },
      topP: {
        label: "Top P",
        hint: "Recorta las palabras menos probables. Más bajo = respuestas más conservadoras.",
      },
      topK: {
        label: "Top K",
        hint: "Limita cuántas palabras candidatas considera el modelo en cada paso.",
      },
      repetitionPenalty: {
        label: "Repetition penalty",
        hint: "Castiga repetir las mismas palabras/frases.",
      },
      frequencyPenalty: {
        label: "Frequency penalty",
        hint: "Escala con cuántas veces ya apareció la palabra.",
      },
      presencePenalty: {
        label: "Presence penalty",
        hint: "Empuja al modelo a tocar temas nuevos.",
      },
      maxTokens: {
        label: "Max tokens",
        hint: "Largo máximo de la respuesta generada.",
      },
      minP: {
        label: "Min P",
        hint: "Filtra palabras muy poco probables relativas a la más probable.",
      },
      seed: {
        label: "Seed",
        hint: "-1 o vacío = aleatorio. Fijalo para reproducir la misma respuesta.",
      },
      n: {
        label: "N (respuestas por generación)",
        hint: "Pide varias respuestas alternativas de una.",
      },
    },
    middleOut: {
      label: "Middle-out",
      hint: "Compresión de contexto del lado del proveedor (solo OpenRouter).",
      allow: "Permitir",
      forbid: "Prohibir",
    },
    reasoning: {
      label: "Devolver el razonamiento",
      hint: "Pide que el modelo devuelva su cadena de pensamiento, cuando el proveedor lo expone.",
    },
    reasoningEffort: {
      label: "Reasoning effort",
      hint: "Cuánto piensa el modelo antes de responder.",
    },
    verbosity: {
      label: "Verbosity",
      hint: "Cuán extensa pide la app que sea la respuesta. Lo ignoran los modelos que no lo soportan.",
    },
    contextSize: {
      label: "Tamaño de contexto",
      hint: "El historial viejo se recorta cuando se pasa de este presupuesto. Es una estimación (~4 chars por token), no un tokenizer real.",
    },
    squashSystemMessages: {
      label: "Squash System Messages",
      hint: "Funde en uno solo los mensajes de sistema consecutivos (contexto, memoria, engine...). Mejora la coherencia en algunos modelos.",
    },
    strictAlternation: {
      label: "Alternancia estricta de roles",
      hint: "Funde mensajes consecutivos del mismo rol. Varios modelos rechazan requests que no alternan estrictamente.",
    },
  },
  /** Recast-preset manager: the chain of passes that rewrites a response before review. */
  recast: {
    title: "Presets de Recast",
    description:
      "Cada preset es una cadena de pasadas que se aplican en orden a la respuesta del modelo antes de mostrártela para revisión.",
    empty: "Todavía no creaste ningún preset de Recast.",
    passCount: "({count} pasadas)",
    loadExamples: "Cargar presets de ejemplo",
    addPass: "Agregar pasada",
    newPass: "Nueva pasada",
    moveUp: "Mover arriba",
    moveDown: "Mover abajo",
    removePass: "Quitar pasada",
    contextLabel: "Contexto (mensajes previos)",
    modelLabel: "Modelo (opcional)",
    modelHint: "Vacío = usa el default de la app. Buscá y elegí de la lista de OpenRouter.",
    modelPlaceholder: "(default de la app)",
    useDefault: "Usar default",
    includeCharacter: "Incluir personaje",
    includeRecentHistory: "Incluir historial reciente",
    passPromptHint:
      "Se manda tal cual está escrito. Si el texto fija un idioma (por ejemplo, una regla que pide responder siempre en español), esa regla gana sobre el Idioma de salida configurado.",
    passPromptLabel: "Prompt de esta pasada",
    passPromptPlaceholder: "Prompt de edición de esta pasada...",
    /**
     * Names of the example preset and of its passes (lib/recastDefaults.ts). They are the names the
     * original Recast extension ships, so the Spanish UI already shows them in English: the same
     * value in both catalogs. Editable by the user once the preset is loaded.
     */
    example: {
      name: "Default Preset",
      grounding: "⛓️ Grounding",
      characterBehaviorValidator: "✅ Character Behavior Validator",
      proseRhythm: "✒️ Prose Rhythm",
      repetitionHammer: "🔨 Repetition Hammer",
    },
  },
};
