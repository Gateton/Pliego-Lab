/**
 * NPC Tracker: roster, settings, dossiers.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const npc = {
  /** Labels of the built-in dossier fields. Resolved where a field is displayed or persisted. */
  builtinFields: {
    appearance: "Apariencia",
    personality: "Personalidad",
    role: "Rol",
    background: "Contexto",
    speechStyle: "Manera de hablar",
    exampleLines: "Líneas de ejemplo",
    motivation: "Motivación actual",
    logline: "Resumen (una frase)",
    defaultStanceToStranger: "Postura ante un extraño",
    secrets: "Secretos",
    mannerisms: "Manerismos",
    narrativeLimits: "Límites narrativos",
    imageTags: "Tags de imagen",
  },
  /** Shared dossier field editor. The labels themselves are data: they come from the settings. */
  dossier: {
    tagsPlaceholder: "1girl, silver hair, violet eyes…",
  },
  /** Per-chat cast: the NPC list and the dossier of the selected one. */
  roster: {
    disabled: {
      title: "El NPC Tracker está apagado",
      // Split around the top-bar button name, which is translated on its own.
      prefix: "Activalo desde el botón",
      suffix: "de la barra superior (configuración) y volvé acá para escanear el chat.",
    },
    title: "Elenco de este chat",
    characterCount: "personajes",
    characterCount_one: "personaje",
    characterCount_other: "personajes",
    autoScan: " · auto-scan cada {interval} msgs",
    manualScan: " · escaneo manual",
    scan: "Escanear chat",
    scanning: "Escaneando…",
    evolve: "Evolucionar",
    evolving: "Evolucionando…",
    evolveTitle:
      'Relee los últimos {messages} mensajes y actualiza (sobreescribiendo) los campos de las fichas que genuinamente cambiaron — a diferencia de "Escanear chat", que solo llena campos vacíos.',
    evolveResult: "{count} fichas actualizadas",
    evolveResult_one: "{count} ficha actualizada",
    evolveResult_other: "{count} fichas actualizadas",
    evolveNoChanges: "Sin cambios genuinos detectados",
    favorites: {
      label: "Favoritos ({count}) — importables a cualquier chat",
      import: "Importar a este chat",
      remove: "Quitar de favoritos",
    },
    personas: {
      label: "Personas ({count}) — importables como NPC a cualquier chat",
      import: "Importar a este chat como NPC",
    },
    empty: {
      title: "Todavía no hay NPCs detectados en este chat.",
      hint: 'Tocá "Escanear chat" para analizar la historia y armar las fichas del elenco.',
    },
    unnamed: "(sin nombre)",
    mainCharTag: "(CHAR)",
    mainCharBadge: "CHAR",
    mainCharHint:
      "Este NPC es el {{char}} de este chat — sus campos de apariencia/personalidad/rol/contexto/tags viven en su Character Card, no acá.",
    number: "N° {index}",
    namePlaceholder: "Nombre",
    generatePortrait: "Generar retrato desde las tags",
    favorite: "Marcar como favorito (importable a otros chats)",
    regenerate: "Regenerar ficha completa desde la conversación (solo tiene efecto en el chat donde nació)",
    delete: "Borrar ficha",
    noPhoto: "sin foto",
    consolidate: "Compactar este campo con IA, preservando todos los hechos (útil si quedó muy largo por evolución acumulada)",
    consolidateShort: "Compactar",
    selectCharacter: "Seleccioná un personaje de la lista.",
    error: {
      evolve: "Error al evolucionar las fichas",
      portrait: "Error al generar el retrato (¿ComfyInject está habilitado?)",
      favorite: "Error al favoritear el NPC",
      regenerate: "Error al regenerar la ficha",
      consolidate: "Error al compactar el campo",
      removeFavorite: "Error al quitar el favorito",
    },
  },
  /** Tracker settings: scanner model, scanning, main character, evolution, dossier fields. */
  settings: {
    description:
      "Escanea el chat y arma un roster de personajes secundarios con su apariencia, tags y personalidad. Por chat e independiente de Roleplay.",
    sections: {
      model: "Modelo del scanner",
      autoScan: "Escaneo automático",
      mainCharacter: "Personaje principal",
      evolution: "Evolución automática",
      fields: "Campos de la ficha",
    },
    enabled: {
      label: "Habilitado",
      hint: "Si está apagado, no se escanea ni se inyecta nada. El botón de NPCs del chat sigue visible para que lo actives cuando quieras.",
    },
    model: {
      label: "Modelo",
      hint: "El modelo de OpenRouter que lee el chat y extrae los NPCs. Vacío = usa el modelo default de la app.",
      placeholder: "(usar modelo default de la app)",
      clear: "Usar modelo default",
    },
    autoScan: {
      label: "Auto-escanear (por intervalo)",
      hint: "Escanea automáticamente los mensajes nuevos a medida que llegan, cada cierta cantidad de mensajes — gasta una llamada al modelo cada vez, aparezca o no un NPC nuevo.",
    },
    interval: "Intervalo (mensajes)",
    heuristic: {
      label: "Auto-escaneo heurístico (gratis)",
      hint: "Detecta nombres nuevos en el texto con un heurístico local (sin costo de tokens) y dispara el escaneo incremental solo cuando hace falta. Convive con el auto-escaneo por intervalo.",
    },
    mainCharacter: {
      label: "Incluir al personaje principal",
      hint: "Le genera al {{char}} de este chat los campos de portabilidad (manera de hablar, secretos, etc.) — NUNCA los que ya vienen de su Character Card (apariencia, personalidad, rol, contexto, tags de imagen), para no tener dos versiones compitiendo. Aparece marcado con (CHAR) en el roster.",
    },
    evolution: {
      label: "Evolucionar fichas cada X mensajes",
      hint: "A diferencia del escaneo normal (que solo llena campos vacíos), esto SÍ puede sobreescribir un campo ya escrito si el modelo detecta un cambio genuino en los últimos mensajes. Gasta una llamada al modelo cada vez que se dispara — solo corre si ya hay al menos un NPC trackeado.",
    },
    fields: {
      description:
        "Estos son los campos que el scanner extrae de cada NPC y que se muestran en la ficha. Podés renombrarlos, reordenarlos, cambiar su tipo o agregar/quitar.",
      add: "Agregar campo",
      newFieldDefault: "Nuevo campo",
      moveUp: "Subir",
      moveDown: "Bajar",
      remove: "Quitar campo",
      default: "default",
      evolveModeHint:
        'Cómo la evolución automática actualiza este campo: "Solo suma" nunca borra lo que ya había, "Reemplaza" lo sobreescribe entero con la versión actual que reporte el modelo.',
      evolveMode: {
        replace: "Reemplaza",
        append: "Solo suma",
      },
      reset: "Restaurar campos por defecto",
    },
    kind: {
      text: "Texto",
      textarea: "Párrafo",
      tags: "Tags",
    },
    saving: "Guardando…",
    saved: "Guardado ✓",
  },
};
