/**
 * Gateton-Roleplay: the module and its submodules.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const roleplay = {
  /** Toggle label the Pluma and Director modules share. */
  toggle: {
    enabled: "Enabled",
  },
  /** Save confirmation every module of the hub shows for two seconds. */
  saved: "Saved.",
  /** The module grid: header, category headings, cards and the status bar. */
  hub: {
    subtitle: "Roleplay control hub",
    active: "Active",
    none: "none",
    back: "Back",
    /** Body of the card of a module that is not built yet. */
    comingSoon: "Content coming soon",
    soon: "Coming soon",
    activate: "Enable",
    deactivate: "Disable",
    category: {
      core: "Core",
      world: "World",
      combat: "Combat",
      narrative: "Narrative",
      visual: "Visual",
    },
    /**
     * Card copy per module. Pluma keeps its label in `roleplay.pluma.title`, which the dedicated
     * editor view reuses as its own title.
     */
    module: {
      mind: {
        label: "Mind",
        description: "How the model thinks, remembers and reasons",
      },
      pluma: {
        description: "Tell the model how to write: narration, dialogue, sounds",
      },
      world: {
        label: "World",
        description: "Places, weather, atmosphere, geography",
      },
      lore: {
        label: "Lore",
        description: "History, rules, mythology of the world",
      },
      characters: {
        label: "Characters",
        description: "NPCs, relationships, looks, backstories",
      },
      combat: {
        label: "Combat",
        description: "Damage systems, turns, skills",
      },
      defense: {
        label: "Defense",
        description: "Armor, resistances, shields, buffs",
      },
      inventory: {
        label: "Inventory",
        description: "Items, gear, resources, economy",
      },
      journal: {
        label: "Journal",
        description: "Active quests, side missions, clues",
      },
      explore: {
        label: "Exploration",
        description: "Maps, routes, points of interest, travel",
      },
      director: {
        label: "Director",
        description: "Secondary model that inserts images at narrative moments",
      },
    },
    /** Line a module that is still a placeholder shows under its name. */
    placeholder: {
      mind: "Memory Plus, context, reasoning",
      world: "Places, weather, atmosphere",
      lore: "History, rules, mythology",
      characters: "NPCs, relationships, looks",
      combat: "Combat systems, turns, damage",
      defense: "Armor, resistances, buffs",
      inventory: "Items, gear, resources",
      journal: "Quests, missions, clues",
      explore: "Maps, routes, points of interest",
    },
  },
  /** Estilo de Pluma: writing-format rules, injected into the model's prompt. */
  pluma: {
    title: "Pluma Style",
    description: "Tell the model how to write: narration, dialogue, sounds and prohibitions.",
    newRule: "New rule",
    empty: "No rules yet. Add one or insert a template.",
    addRule: "Add rule",
    insertTemplate: "Insert template",
    preview: "Preview",
    previewHint: "— this is what the model gets",
    disabled: "The module is off or has no active rules — nothing is injected into the prompt.",
    ruleTitle: "Title (e.g. Narration)",
    deleteRule: "Delete rule",
    instruction: "What to do / what not to do",
    exampleBadge: "Ex",
    example: "Short example (optional)",
    /**
     * Ready-made rules the picker offers. `name` is interface copy and is translated; `instruction`
     * and `example` are prompt content sent to the model as written, so both locales keep the same
     * English wording on purpose.
     */
    template: {
      narration: {
        name: "Narration",
        instruction: "All narration, actions and descriptions ALWAYS go between *asterisks*, never as plain text and never with dashes.",
        example: "*Lara tells the duke to shut up*",
      },
      dialogue: {
        name: "Dialogue",
        instruction: 'Dialogue is preceded by the character\'s name and wrapped in <font color="#HEX">, with one fixed color per character.',
        example: 'Duke: <font color="#c0392b">"Shut up!"</font>',
      },
      sounds: {
        name: "Sounds",
        instruction: "Sounds and onomatopoeia go inside <font color> within the narration.",
        example: '*Just then there was a* <font color="#HEX">TOK</font> *and everyone panicked*',
      },
      noDashes: {
        name: "Forbidden",
        instruction: "NEVER use em dashes (—) or bare quotes for narration or dialogue.",
      },
    },
  },
  /** Image Director: the secondary model that inserts image tags in the narrative. */
  director: {
    experimental: "EXPERIMENTAL",
    description: "A secondary model reads the main model's reply and inserts image tags [[IMG:...]] at the right narrative moments. ComfyInject then renders the images.",
    selectModel: "Select a model…",
    searchModel: "Search models…",
    loadingModels: "Loading models…",
    noResults: "No results",
    minTags: {
      label: "Minimum tags per image",
      hintWithMin: "Every [[IMG:...]] must have at least {count} comma-separated tags. 0 = no minimum.",
      hintNone: "No enforced minimum (current behavior). Set a number to require a floor of tags per image.",
    },
    model: {
      label: "Director model",
      hint: "The model that decides where to insert images.",
    },
    maxImages: {
      label: "Images per turn",
      hint: "Up to {count} images per reply.",
    },
    triggerMode: {
      label: "Trigger mode",
      hint: "Manual = button. Auto = every model reply.",
      manual: "Manual (button)",
      auto: "Automatic (every reply)",
    },
    generation: {
      title: "Generation",
      description: "Fine control of the Director model: determinism, output cap and reasoning.",
    },
    temperature: {
      label: "Temperature",
      hint: "Lower = more deterministic tags.",
    },
    topP: {
      label: "Top P",
      hint: "Nucleus sampling.",
    },
    maxTokens: {
      label: "Max tokens",
      hint: "Output cap for the Director (cost control).",
    },
    thinkingEffort: {
      label: "Thinking effort",
      hint: "How much the Director reasons before inserting tags.",
      off: "Off (no thinking)",
      auto: "Auto (the model decides)",
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    timeout: {
      label: "Timeout",
      hint: "How long the chat waits before giving up with 'the Director took too long to respond'. With medium or high thinking effort, rich tags and a high images-per-turn cap, the model can take a while — raise it if you hit that error often (you can always cancel from the chat).",
    },
    context: {
      title: "Context",
      description: "What else the Director sees besides the text being analyzed.",
      includeCharacter: "Include character",
      includeCharacterHint: "Sends the character card (appearance, personality, image tags).",
      includePersona: "Include persona",
      includePersonaHint: "Sends the image tags of your active persona (if you filled them in Personas), for scenes that need to show it — without this, the Director makes up something generic when your persona has to appear.",
      depth: "Message depth",
      depthHint: "Last {count} messages as context.",
    },
    instructions: {
      label: "Director instructions",
      hint: "Tell the model how and when to insert images.",
    },
    clear: "Clear",
    jailbreak: {
      label: "JAILBREAK",
      hint: "When off, the content below is not sent to the Director.",
      promptLabel: "JAILBREAK prompt",
      promptHint: "Appended to the end of the system prompt to reinforce the Director instructions. It does not bypass provider policies.",
      placeholder: "Write the Director jailbreak here…",
    },
    test: {
      title: "Test Director",
      hint: "Paste a text and the Director inserts image tags where they belong.",
      placeholder: "Paste model output here to test…",
      running: "Running…",
      run: "Run Director",
    },
    runError: "Error: {message}",
  },
};
