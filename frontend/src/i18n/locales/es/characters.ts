/**
 * Character cards: creator, editor, import/export, greeting tools.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const characters = {
  /**
   * Verbs and states shown by more than one screen of this batch (character creator, character
   * editor, persona manager). They sit here, and not in `common`, because `common` is maintained
   * by the coordinator: after the migration lands they are candidates to move there.
   */
  action: {
    discard: "Descartar",
    delete: "Borrar",
    edit: "Editar",
    generating: "Generando…",
    remove: "Quitar",
    saving: "Guardando…",
  },
  /** Character Card V2 field labels, shared by the creator, the editor and the persona form. */
  card: {
    creator: "Creador",
    creatorNotes: "Notas del creador",
    description: "Descripción",
    dialogueExamples: "Ejemplos de diálogo",
    firstMessage: "Primer mensaje",
    firstMessageGreeting: "Primer mensaje / Greeting",
    imageTags: "Image tags",
    imageTagsDanbooru: "Tags de imagen (Danbooru)",
    name: "Nombre",
    personality: "Personalidad",
    postHistoryInstructions: "Post-history instructions",
    postHistoryInstructionsJailbreak: "Post-history instructions / jailbreak",
    scenario: "Escenario",
    systemPrompt: "System prompt",
    tags: "Tags",
    version: "Versión",
  },
  creator: {
    title: "Character Creator",
    description: "Describí una idea y generá una Character Card completa. Revisá todo antes de guardarla.",
    idea: {
      label: "¿Qué personaje querés crear?",
      hint: "Describilo con el nivel de detalle que quieras: historia, personalidad, aspecto, relaciones, conflicto y tono.",
      placeholder: "Ej.: Una comandante veterana de una ciudad sitiada, endurecida por la guerra pero protectora con los civiles…",
    },
    context: {
      title: "Contexto de referencia",
      optional: "Opcional",
      description: "Elegí un personaje, un mundo o un escenario existente. La IA lo usará como contexto para que el nuevo personaje encaje en ese universo.",
      remove: "Quitar contexto",
      world: "Mundo / escenario",
      character: "Personaje",
      reference: "Se usará como referencia del universo",
      change: "Cambiar",
      searchCta: "Buscar un personaje o mundo",
      searchHint: "Podés usar cualquier ficha como contexto",
      available: "{count} disponibles",
      searchPlaceholder: "Buscar por nombre o tag…",
      noMatches: "No encontramos coincidencias.",
      filter: {
        all: "Todos",
        characters: "Personajes",
        worlds: "Mundos",
      },
    },
    worldToggle: {
      label: "Crear mundo/escenario",
      hint: "Marcá esto si la tarjeta describe un lugar, época, facción o entorno narrativo.",
    },
    image: {
      alt: "Preview",
      empty: "Sin imagen",
      upload: "Subir imagen PNG",
      needTags: "Generá primero la ficha para obtener image tags",
      generateHint: "Generar retrato usando ComfyInject",
      generating: "Generando con ComfyInject…",
      generate: "Generar con ComfyInject",
    },
    generate: "Generar personaje",
    errorDetails: "Ver qué respondió y razonó",
    draft: {
      title: "Borrador generado",
      description: "Revisá y editá todos los campos. Todavía no se guardó.",
    },
    changes: {
      title: "Cambios de esta generación",
      field: "campo",
      fields: "campos",
      hint: "Los campos resaltados fueron agregados o modificados por la IA. Abrí cada uno para comparar el contenido exacto.",
      new: "Nuevo",
      changed: "Modificado",
      before: "Antes",
      empty: "(vacío)",
      notice: "La IA cambió este campo en la última generación",
    },
    tagsHint: "Separados por comas.",
    refine: {
      label: "Modo de refinamiento",
      hint: "Escribí qué querés mejorar. La IA recibirá este borrador y devolverá una nueva versión completa.",
      placeholder: "Ej.: Hacelo menos heroico, más contradictorio y adaptalo mejor al mundo seleccionado.",
      action: "Refinar personaje",
      busy: "Refinando…",
    },
    save: {
      action: "Guardar personaje",
      hint: "Se guardará usando el formato de tus personajes importados.",
    },
    diagnosis: {
      title: "Diagnóstico de la generación",
      description: "Acá podés revisar el razonamiento que el proveedor expuso y la respuesta exacta que recibió Pliego Lab.",
      reasoningTitle: "Razonamiento del modelo",
      reasoningEmpty: "El proveedor no devolvió razonamiento visible para esta generación.",
      responseTitle: "Respuesta exacta recibida",
      responseEmpty: "El proveedor no devolvió contenido visible.",
    },
    /** Hints of the generated draft fields. The labels come from `card`. */
    hint: {
      creatorNotes: "Información útil para vos, no se envía al modelo durante el chat.",
      description: "Quién es, su apariencia, historia y rasgos importantes.",
      dialogueExamples: "Muestras de voz, estilo y forma de expresarse.",
      imageTags: "Tags visuales en inglés para mantener consistente su apariencia.",
      personality: "Carácter, deseos, límites, contradicciones y forma de pensar.",
      postHistoryInstructions: "Instrucciones que se aplican después del historial del chat.",
      scenario: "Dónde comienza la historia y qué situación está ocurriendo.",
      firstMessage: "El mensaje inicial que usará al comenzar un chat.",
      systemPrompt: "Reglas privadas de comportamiento para este personaje.",
    },
    error: {
      pngRequired: "La imagen debe ser PNG para mantener la compatibilidad con las Character Cards.",
      generate: "No se pudo generar el personaje.",
      image: "No se pudo generar la imagen con ComfyInject.",
      portraitDownload: "No se pudo descargar el retrato generado para guardarlo.",
      nameRequired: "El personaje necesita un nombre antes de guardarse.",
      save: "No se pudo guardar el personaje.",
    },
  },
  editor: {
    title: "Editar a {name}",
    description: "Estos campos arman la ficha que el modelo lee en cada mensaje. Cuanto más claros, más consistente se mantiene el personaje.",
    changeImage: "Cambiar imagen",
    worldToggle: {
      label: "Es un mundo/escenario, no una persona",
      hint: "Marcá esto para chars tipo 'una isla', 'una ciudad', un escenario general, etc. — nunca se va a trackear como NPC/personaje principal en NPC Tracker aunque tengas activado 'Incluir personaje principal', porque un mundo no tiene apariencia física, secretos ni manerismos que registrar.",
    },
    greeting: {
      label: "Greeting",
      translate: "Traducir greeting",
      translating: "Traduciendo…",
      regenerate: "Regenerar greeting",
      generatedNotice: "Greeting generado — no se aplica hasta que lo uses:",
      use: "Usar este greeting",
      translatedNotice: "Greeting traducido — no se aplica hasta que lo uses:",
      useTranslation: "Usar esta traducción",
    },
    imageTags: {
      generate: "Generar tags por IA",
      generatedNotice: "Tags generados — no se aplican hasta que los uses:",
      use: "Usar estos tags",
    },
    knowledge: {
      title: "Conocimiento",
      description: "Los lorebooks vinculados se consultan automáticamente en cada chat con este personaje.",
      embeddedTitle: "Lorebook embebido",
      embeddedHint: "Vino dentro de la Character Card y viajará con ella al exportarla.",
      libraryLabel: "Lorebooks de la biblioteca",
      libraryHint: "El primero actúa como libro principal. Podés vincular varios sin duplicar sus entradas.",
      empty: "Todavía no hay lorebooks en tu biblioteca. Crealos desde el botón Lorebooks de la barra superior.",
    },
    tagsHint: "Separados por coma. Sirven para buscar/filtrar personajes.",
    /** Hints of the editor fields. The labels come from `card`. */
    hint: {
      creatorNotes: "Solo informativo, no se envía al modelo.",
      description: "Quién es: apariencia, historia, rasgos clave. Va siempre en el prompt.",
      dialogueExamples: "Muestras de cómo habla, para que el modelo imite el estilo.",
      imageTags: "Apariencia del personaje como tags Danbooru (pelo, ojos, piel, cuerpo). La IA los usa como base para cada imagen generada.",
      personality: "Resumen corto de carácter y forma de hablar.",
      postHistoryInstructions: "Se inyecta después del historial de mensajes, justo antes de la respuesta.",
      scenario: "El contexto/lugar donde arranca la historia.",
      firstMessage: "Lo primero que dice el personaje al empezar un chat nuevo.",
      systemPrompt: "Sobreescribe el system prompt global solo para este personaje. Dejalo vacío para usar el default.",
    },
    error: {
      greetingGenerate: "Error al generar el greeting",
      greetingTranslate: "Error al traducir el greeting",
      tagsGenerate: "Error al generar los tags",
    },
  },
};
