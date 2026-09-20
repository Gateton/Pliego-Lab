/**
 * Estudio: rules and libraries.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const estudio = {
  /** The shell every section of the panel shares. */
  panel: {
    sections: "Secciones de Estudio",
  },
  /** Reglas: optional rule packs appended to the prompt, plus how dialogue is rendered. */
  rules: {
    title: "Reglas",
    description: "Sistemas opcionales que se suman a la narración. Activá los que uses, editalos o creá los tuyos.",
    newRule: "Nueva regla",
    /**
     * `{count}` selects the plural form: the base key is only a fallback, the `_one` / `_other`
     * variants are what both locales render.
     */
    activeCount: "{count} activas",
    activeCount_one: "{count} activa",
    activeCount_other: "{count} activas",
    off: "Apagadas",
    enabled: "Usar las reglas activas",
    enabledHint: "Con esto apagado, ninguna regla se envía al modelo.",
    coloredDialogue: "Diálogo coloreado",
    coloredDialogueHint: "Regla de formato que envuelve el diálogo hablado en <font color>: cada personaje habla con su color.",
    emptyTitle: "Todavía no hay reglas",
    emptyBody: "Una regla es un bloque de instrucciones que se inyecta cuando la activás: dados, combate, lenguaje directo, lo que necesites.",
    activate: "Activar",
    active: "Activa",
    deactivate: "Desactivar",
    name: "Nombre de la regla",
    duplicate: "Duplicar",
    duplicateRule: "Duplicar regla",
    delete: "Borrar",
    deleteRule: "Borrar regla",
    copyName: "{name} (copia)",
    customDescription: "Regla creada por vos.",
    trigger: "Trigger",
    exclusiveGroup: "Grupo exclusivo",
    rolls: "Tiradas",
    content: "Contenido (regla propia)",
    contentPlaceholder: "Instrucciones que se inyectan cuando la regla está activa…",
  },
  /** Badges the list/editor layout shows for every library of the panel. */
  library: {
    active: "activo",
  },
};
