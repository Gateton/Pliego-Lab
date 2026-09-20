/**
 * NPC Tracker: roster, settings, dossiers.
 *
 * Same keys as the Spanish catalog, different values. "NPC Tracker" and "CHAR" are feature names
 * and stay as they are.
 */
export const npc = {
  /** Labels of the built-in dossier fields. Resolved where a field is displayed or persisted. */
  builtinFields: {
    appearance: "Appearance",
    personality: "Personality",
    role: "Role",
    background: "Background",
    speechStyle: "Speaking style",
    exampleLines: "Example lines",
    motivation: "Current motivation",
    logline: "Summary (one line)",
    defaultStanceToStranger: "Stance toward a stranger",
    secrets: "Secrets",
    mannerisms: "Mannerisms",
    narrativeLimits: "Narrative limits",
    imageTags: "Image tags",
  },
  /** Shared dossier field editor. The labels themselves are data: they come from the settings. */
  dossier: {
    tagsPlaceholder: "1girl, silver hair, violet eyes…",
  },
  /** Per-chat cast: the NPC list and the dossier of the selected one. */
  roster: {
    disabled: {
      title: "The NPC Tracker is off",
      // Split around the top-bar button name, which is translated on its own.
      prefix: "Turn it on from the",
      suffix: "button in the top bar (settings), then come back here to scan the chat.",
    },
    title: "Cast of this chat",
    characterCount: "characters",
    characterCount_one: "character",
    characterCount_other: "characters",
    autoScan: " · auto-scan every {interval} msgs",
    manualScan: " · manual scan",
    scan: "Scan chat",
    scanning: "Scanning…",
    evolve: "Evolve",
    evolving: "Evolving…",
    evolveTitle:
      'Re-reads the last {messages} messages and updates (overwriting) the fields of the dossiers that genuinely changed — unlike "Scan chat", which only fills in empty fields.',
    evolveResult: "{count} dossiers updated",
    evolveResult_one: "{count} dossier updated",
    evolveResult_other: "{count} dossiers updated",
    evolveNoChanges: "No genuine changes detected",
    favorites: {
      label: "Favorites ({count}) — importable into any chat",
      import: "Import into this chat",
      remove: "Remove from favorites",
    },
    personas: {
      label: "Personas ({count}) — importable into any chat as NPCs",
      import: "Import into this chat as an NPC",
    },
    empty: {
      title: "No NPCs detected in this chat yet.",
      hint: 'Hit "Scan chat" to read the story and build the cast dossiers.',
    },
    unnamed: "(no name)",
    mainCharTag: "(CHAR)",
    mainCharBadge: "CHAR",
    mainCharHint:
      "This NPC is the {{char}} of this chat — their appearance/personality/role/background/image tag fields live in their Character Card, not here.",
    number: "No. {index}",
    namePlaceholder: "Name",
    generatePortrait: "Generate the portrait from the tags",
    favorite: "Mark as favorite (importable into other chats)",
    regenerate: "Regenerate the whole dossier from the conversation (only takes effect in the chat where it was born)",
    delete: "Delete dossier",
    noPhoto: "no photo",
    consolidate: "Compact this field with AI, keeping every fact (useful when accumulated evolution made it too long)",
    consolidateShort: "Compact",
    selectCharacter: "Pick a character from the list.",
    error: {
      evolve: "Could not evolve the dossiers",
      portrait: "Could not generate the portrait (is ComfyInject enabled?)",
      favorite: "Could not favorite the NPC",
      regenerate: "Could not regenerate the dossier",
      consolidate: "Could not compact the field",
      removeFavorite: "Could not remove the favorite",
    },
  },
  /** Tracker settings: scanner model, scanning, main character, evolution, dossier fields. */
  settings: {
    description:
      "Scans the chat and builds a roster of side characters with their appearance, tags and personality. Per chat and independent from Roleplay.",
    sections: {
      model: "Scanner model",
      autoScan: "Automatic scanning",
      mainCharacter: "Main character",
      evolution: "Automatic evolution",
      fields: "Dossier fields",
    },
    enabled: {
      label: "Enabled",
      hint: "When it is off, nothing is scanned and nothing is injected. The chat's NPCs button stays visible so you can turn it on whenever you want.",
    },
    model: {
      label: "Model",
      hint: "The OpenRouter model that reads the chat and extracts the NPCs. Empty = use the app's default model.",
      placeholder: "(use the app's default model)",
      clear: "Use the default model",
    },
    autoScan: {
      label: "Auto-scan (by interval)",
      hint: "Scans new messages automatically as they arrive, every so many messages — it spends one model call each time, whether or not a new NPC shows up.",
    },
    interval: "Interval (messages)",
    heuristic: {
      label: "Heuristic auto-scan (free)",
      hint: "Finds new names in the text with a local heuristic (no token cost) and only fires the incremental scan when it is actually needed. It works alongside the interval auto-scan.",
    },
    mainCharacter: {
      label: "Include the main character",
      hint: "Gives this chat's {{char}} the portability fields (speaking style, secrets, etc.) — NEVER the ones that already come from their Character Card (appearance, personality, role, background, image tags), so two versions never compete. Shows up tagged with (CHAR) in the roster.",
    },
    evolution: {
      label: "Evolve dossiers every X messages",
      hint: "Unlike the normal scan (which only fills empty fields), this one CAN overwrite a field that already has content when the model detects a genuine change in the latest messages. It spends one model call every time it fires — it only runs when at least one NPC is already tracked.",
    },
    fields: {
      description:
        "These are the fields the scanner extracts from every NPC and shows in the dossier. You can rename them, reorder them, change their type, or add and remove them.",
      add: "Add field",
      newFieldDefault: "New field",
      moveUp: "Move up",
      moveDown: "Move down",
      remove: "Remove field",
      default: "default",
      evolveModeHint:
        'How automatic evolution updates this field: "Adds only" never erases what was already there, "Replaces" overwrites it entirely with the current version the model reports.',
      evolveMode: {
        replace: "Replaces",
        append: "Adds only",
      },
      reset: "Restore the default fields",
    },
    kind: {
      text: "Text",
      textarea: "Paragraph",
      tags: "Tags",
    },
    saving: "Saving…",
    saved: "Saved ✓",
  },
};
