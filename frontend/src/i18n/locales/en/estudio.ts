/**
 * Estudio: rules and libraries.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const estudio = {
  /** The shell every section of the panel shares. */
  panel: {
    sections: "Studio sections",
  },
  /** Reglas: optional rule packs appended to the prompt, plus how dialogue is rendered. */
  rules: {
    title: "Rules",
    description: "Optional systems that join the narration. Turn on the ones you use, edit them, or write your own.",
    newRule: "New rule",
    /**
     * `{count}` selects the plural form: the base key is only a fallback, the `_one` / `_other`
     * variants are what both locales render.
     */
    activeCount: "{count} active",
    activeCount_one: "{count} active",
    activeCount_other: "{count} active",
    off: "Off",
    enabled: "Use the active rules",
    enabledHint: "With this off, no rule is sent to the model.",
    coloredDialogue: "Colored dialogue",
    coloredDialogueHint: "Format rule that wraps spoken dialogue in <font color>: every character speaks in their own color.",
    emptyTitle: "No rules yet",
    emptyBody: "A rule is a block of instructions injected when you turn it on: dice, combat, direct language, whatever you need.",
    activate: "Enable",
    active: "Active",
    deactivate: "Disable",
    name: "Rule name",
    duplicate: "Duplicate",
    duplicateRule: "Duplicate rule",
    delete: "Delete",
    deleteRule: "Delete rule",
    copyName: "{name} (copy)",
    customDescription: "A rule you wrote.",
    trigger: "Trigger",
    exclusiveGroup: "Exclusive group",
    rolls: "Rolls",
    content: "Content (custom rule)",
    contentPlaceholder: "Instructions injected while the rule is active…",
  },
  /** Badges the list/editor layout shows for every library of the panel. */
  library: {
    active: "active",
  },
};
