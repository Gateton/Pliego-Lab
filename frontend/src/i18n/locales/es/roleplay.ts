/**
 * Gateton-Roleplay: the module and its submodules.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const roleplay = {
  /** Toggle label the Pluma and Director modules share. */
  toggle: {
    enabled: "Habilitado",
  },
  /** Save confirmation every module of the hub shows for two seconds. */
  saved: "Guardado.",
  /** The module grid: header, category headings, cards and the status bar. */
  hub: {
    subtitle: "Hub de control del roleplay",
    active: "Activos",
    none: "ninguno",
    back: "Volver",
    /** Body of the card of a module that is not built yet. */
    comingSoon: "Contenido próximamente",
    soon: "Próximamente",
    activate: "Activar",
    deactivate: "Desactivar",
    category: {
      core: "Núcleo",
      world: "Mundo",
      combat: "Combate",
      narrative: "Narrativa",
      visual: "Visual",
    },
    /**
     * Card copy per module. Pluma keeps its label in `roleplay.pluma.title`, which the dedicated
     * editor view reuses as its own title.
     */
    module: {
      mind: {
        label: "Mente",
        description: "Cómo piensa, recuerda y razona el modelo",
      },
      pluma: {
        description: "Decile al modelo cómo escribir: narración, diálogo, sonidos",
      },
      world: {
        label: "Mundo",
        description: "Lugares, clima, atmósfera, geografía",
      },
      lore: {
        label: "Lore",
        description: "Historia, reglas, mitología del mundo",
      },
      characters: {
        label: "Personajes",
        description: "NPCs, relaciones, apariencias, historias",
      },
      combat: {
        label: "Combate",
        description: "Sistemas de daño, turnos, habilidades",
      },
      defense: {
        label: "Defensa",
        description: "Armaduras, resistencias, escudos, buffs",
      },
      inventory: {
        label: "Inventario",
        description: "Objetos, equipo, recursos, economía",
      },
      journal: {
        label: "Diario",
        description: "Quests activas, misiones secundarias, pistas",
      },
      explore: {
        label: "Exploración",
        description: "Mapas, rutas, puntos de interés, viajes",
      },
      director: {
        label: "Director",
        description: "Modelo secundario que inserta imágenes en momentos narrativos",
      },
    },
    /** Line a module that is still a placeholder shows under its name. */
    placeholder: {
      mind: "Memory Plus, contexto, razonamiento",
      world: "Lugares, clima, atmósfera",
      lore: "Historia, reglas, mitología",
      characters: "NPCs, relaciones, apariencias",
      combat: "Sistemas de combate, turnos, daño",
      defense: "Armaduras, resistencias, buffs",
      inventory: "Objetos, equipo, recursos",
      journal: "Quests, misiones, pistas",
      explore: "Mapas, rutas, puntos de interés",
    },
  },
  /** Estilo de Pluma: writing-format rules, injected into the model's prompt. */
  pluma: {
    title: "Estilo de Pluma",
    description: "Decile al modelo cómo escribir: narración, diálogo, sonidos y prohibiciones.",
    newRule: "Nueva regla",
    empty: "Todavía no hay reglas. Agregá una o insertá una plantilla.",
    addRule: "Agregar regla",
    insertTemplate: "Insertar plantilla",
    preview: "Previsualización",
    previewHint: "— esto le llega al modelo",
    disabled: "El módulo está deshabilitado o no hay reglas activas — no se inyecta nada al prompt.",
    ruleTitle: "Título (ej. Narración)",
    deleteRule: "Borrar regla",
    instruction: "Qué hacer / qué no hacer",
    exampleBadge: "Ej",
    example: "Ejemplo corto (opcional)",
    /**
     * Ready-made rules the picker offers. `name` is interface copy and is translated; `instruction`
     * and `example` are prompt content sent to the model as written, so both locales keep the same
     * English wording on purpose.
     */
    template: {
      narration: {
        name: "Narración",
        instruction: "All narration, actions and descriptions ALWAYS go between *asterisks*, never as plain text and never with dashes.",
        example: "*Lara tells the duke to shut up*",
      },
      dialogue: {
        name: "Diálogo",
        instruction: 'Dialogue is preceded by the character\'s name and wrapped in <font color="#HEX">, with one fixed color per character.',
        example: 'Duke: <font color="#c0392b">"Shut up!"</font>',
      },
      sounds: {
        name: "Sonidos",
        instruction: "Sounds and onomatopoeia go inside <font color> within the narration.",
        example: '*Just then there was a* <font color="#HEX">TOK</font> *and everyone panicked*',
      },
      noDashes: {
        name: "Prohibido",
        instruction: "NEVER use em dashes (—) or bare quotes for narration or dialogue.",
      },
    },
  },
  /** Image Director: the secondary model that inserts image tags in the narrative. */
  director: {
    experimental: "EXPERIMENTAL",
    description: "Un modelo secundario lee la respuesta del modelo principal e inserta tags de imagen [[IMG:...]] en los momentos narrativos correctos. ComfyInject luego renderiza las imágenes.",
    selectModel: "Seleccionar modelo…",
    searchModel: "Buscar modelo…",
    loadingModels: "Cargando modelos…",
    noResults: "Sin resultados",
    minTags: {
      label: "Mínimo de tags por imagen",
      hintWithMin: "Cada [[IMG:...]] debe tener al menos {count} tags separados por coma. 0 = sin mínimo.",
      hintNone: "Sin mínimo forzado (comportamiento actual). Poné un número para exigir un piso de tags por imagen.",
    },
    model: {
      label: "Modelo del Director",
      hint: "El modelo que decide dónde insertar imágenes.",
    },
    maxImages: {
      label: "Imágenes por turno",
      hint: "Máximo {count} imágenes por respuesta.",
    },
    triggerMode: {
      label: "Modo de ejecución",
      hint: "Manual = botón. Auto = cada respuesta del modelo.",
      manual: "Manual (botón)",
      auto: "Automático (cada respuesta)",
    },
    generation: {
      title: "Generación",
      description: "Control fino del modelo del Director: determinismo, tope de output y razonamiento.",
    },
    temperature: {
      label: "Temperature",
      hint: "Más bajo = tags más deterministas.",
    },
    topP: {
      label: "Top P",
      hint: "Nucleus sampling.",
    },
    maxTokens: {
      label: "Max tokens",
      hint: "Tope de output del Director (control de costo).",
    },
    thinkingEffort: {
      label: "Thinking effort",
      hint: "Cuánto razona el Director antes de insertar tags.",
      off: "Off (no piensa)",
      auto: "Auto (el modelo decide)",
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    timeout: {
      label: "Timeout",
      hint: "Cuánto espera el chat antes de rendirse con 'El Director tardó demasiado en responder'. Con thinking effort medio/alto + tags ricos + máximo de imágenes por turno alto, el modelo puede tardar bastante — subilo si ves ese error seguido (podés cancelar manualmente en cualquier momento desde el chat).",
    },
    context: {
      title: "Contexto",
      description: "Qué información adicional ve el Director además del texto a analizar.",
      includeCharacter: "Incluir personaje",
      includeCharacterHint: "Envía la card del personaje (apariencia, personalidad, tags de imagen).",
      includePersona: "Incluir persona",
      includePersonaHint: "Envía los tags de imagen de tu persona activa (si los cargaste en Personas), para cuando una escena necesite mostrarla — sin esto, el Director inventa algo genérico si tu persona tiene que aparecer.",
      depth: "Profundidad de mensajes",
      depthHint: "Últimos {count} mensajes como contexto.",
    },
    instructions: {
      label: "Instrucciones para el Director",
      hint: "Decile al modelo cómo y cuándo insertar imágenes.",
    },
    clear: "Limpiar",
    jailbreak: {
      label: "JAILBREAK",
      hint: "Si está desactivado, el contenido de abajo no se envía al Director.",
      promptLabel: "Prompt JAILBREAK",
      promptHint: "Se agrega al final del prompt del sistema para reforzar las instrucciones del Director. No evita las políticas del proveedor.",
      placeholder: "Escribí aquí el jailbreak del Director…",
    },
    test: {
      title: "Probar Director",
      hint: "Pegá un texto y el Director insertará tags de imagen donde corresponda.",
      placeholder: "Pegá aquí el texto del modelo para probar…",
      running: "Ejecutando…",
      run: "Ejecutar Director",
    },
    runError: "Error: {message}",
  },
};
