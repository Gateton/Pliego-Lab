/**
 * English catalog. Same keys as the Spanish one, same structure, different values. Neutral
 * international English, US spelling, not a literal translation of the Spanish.
 */
export const presets = {
  /** Labels that the response-preset manager and the Recast-preset manager both show. */
  shared: {
    activePreset: "Active preset",
    presetName: "Preset name",
    newPreset: "New preset",
    savePreset: "Save preset",
    model: "Model",
    editPreset: "Edit preset",
    edit: "Edit",
    deletePreset: "Delete preset",
    delete: "Delete",
  },
  /** Response panel (left column): active preset, output language, toggles and the prompt blocks. */
  panel: {
    activePresetHint: "Model: {model}",
    defaultModelFallback: "provider default model",
    noPresetOption: "None (app defaults)",
    editPresets: "Edit presets and parameters →",
    outputLanguage: {
      label: "Output language",
      hint: "Forces the model to always write in this language, ignoring the preset and Roleplay.",
      auto: "No override (auto)",
    },
    contextSize: {
      // Identical to the Spanish catalog: the label is a technical one and was already in English.
      label: "Context Size (tokens)",
      activeHint: "{tokens} tokens — per-turn context window (from the active preset).",
      noPresetHint: "No active preset — pick one in Presets to adjust the context.",
    },
    streaming: {
      label: "Streaming",
      hint: "Shows the response while it is being generated.",
    },
    coloredDialogue: {
      label: "Colored dialogue",
      hint: "Asks the model for a fixed color for each character.",
    },
    blocks: {
      withPreset: "Blocks — {name}",
      global: "Global blocks",
      add: "+ Add",
      emptyWithPreset: "This preset has no prompts.",
      emptyGlobal: "No prompts. Add one or use Roleplay.",
      depth: "Depth",
      contentPlaceholder: "Write the block content...",
      /** Technical names: the same value in both languages. */
      position: {
        system: "System",
        top: "Top",
        inChat: "In-chat",
        postHistory: "Post-history",
      },
      role: {
        system: "System",
        user: "User",
        assistant: "Assistant",
      },
      defaultName: {
        system: "System prompt",
        top: "Pre-chat",
        inChat: "Context",
        postHistory: "Jailbreak",
      },
    },
  },
  /** Response-preset manager: the list of presets and the preset form. */
  manager: {
    title: "Response presets",
    description:
      "A preset defines how the model responds: model, sampling, reasoning, context and compatibility. The provider and its credentials are global (Provider tab). Each preset's prompts are edited in the Response panel on the left.",
    activePresetHint: "The one currently used to generate responses.",
    noPresetsOption: "(no presets)",
    empty: "You have not created any preset yet.",
    providerModelFallback: "provider model",
    promptCount: "{count} prompts",
    noPrompts: "no prompts",
    modelHint: "Empty = default model of the active provider.",
    modelPlaceholder: "Provider model…",
    importPreset: "Import preset",
    importing: "Importing…",
    importSuccess: "Imported: {count} presets.",
    importWithErrors: "Imported: {count} presets. Errors: {errors}",
    importInvalidJson: "The file is not valid JSON.",
    capabilitiesNotice: "Showing only the parameters that {provider} declares it supports.",
    tabs: {
      sampling: "Sampling",
      reasoning: "Reasoning",
      context: "Context and compat",
      connection: "Provider",
    },
  },
  /** Sampling parameters plus the reasoning and context switches of a preset. */
  sampling: {
    auto: "Auto",
    effort: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    fields: {
      temperature: {
        label: "Temperature",
        hint: "How creative or random it is. Higher = more varied, lower = more predictable.",
      },
      topP: {
        label: "Top P",
        hint: "Trims the least likely words. Lower = more conservative responses.",
      },
      topK: {
        label: "Top K",
        hint: "Limits how many candidate words the model considers at each step.",
      },
      repetitionPenalty: {
        label: "Repetition penalty",
        hint: "Penalizes repeating the same words or phrases.",
      },
      frequencyPenalty: {
        label: "Frequency penalty",
        hint: "Scales with how many times the word has already appeared.",
      },
      presencePenalty: {
        label: "Presence penalty",
        hint: "Pushes the model to touch new topics.",
      },
      maxTokens: {
        label: "Max tokens",
        hint: "Maximum length of the generated response.",
      },
      minP: {
        label: "Min P",
        hint: "Filters words that are very unlikely relative to the most likely one.",
      },
      seed: {
        label: "Seed",
        hint: "-1 or empty = random. Set it to reproduce the same response.",
      },
      n: {
        label: "N (responses per generation)",
        hint: "Asks for several alternative responses at once.",
      },
    },
    middleOut: {
      label: "Middle-out",
      hint: "Provider-side context compression (OpenRouter only).",
      allow: "Allow",
      forbid: "Forbid",
    },
    reasoning: {
      label: "Return reasoning",
      hint: "Asks the model to return its chain of thought, when the provider exposes it.",
    },
    reasoningEffort: {
      label: "Reasoning effort",
      hint: "How much the model thinks before answering.",
    },
    verbosity: {
      label: "Verbosity",
      hint: "How long the app asks the response to be. Models that do not support it ignore it.",
    },
    contextSize: {
      label: "Context size",
      hint: "Older history is trimmed once this budget is exceeded. It is an estimate (~4 chars per token), not a real tokenizer.",
    },
    squashSystemMessages: {
      label: "Squash System Messages",
      hint: "Merges consecutive system messages into one (context, memory, engine...). Improves coherence on some models.",
    },
    strictAlternation: {
      label: "Strict role alternation",
      hint: "Merges consecutive messages from the same role. Several models reject requests that do not alternate strictly.",
    },
  },
  /** Recast-preset manager: the chain of passes that rewrites a response before review. */
  recast: {
    title: "Recast presets",
    description:
      "Each preset is a chain of passes applied in order to the model's response before showing it to you for review.",
    empty: "You have not created any Recast preset yet.",
    passCount: "({count} passes)",
    loadExamples: "Load example presets",
    addPass: "Add pass",
    newPass: "New pass",
    moveUp: "Move up",
    moveDown: "Move down",
    removePass: "Remove pass",
    contextLabel: "Context (previous messages)",
    modelLabel: "Model (optional)",
    modelHint: "Empty = uses the app default. Search and pick from the OpenRouter list.",
    modelPlaceholder: "(app default)",
    useDefault: "Use default",
    includeCharacter: "Include character",
    includeRecentHistory: "Include recent history",
    passPromptHint:
      "It is sent exactly as written. If the text pins a language, that rule wins over the configured output language.",
    passPromptLabel: "Pass prompt",
    passPromptPlaceholder: "Edit prompt for this pass...",
    /** Identical to the Spanish catalog: the example preset ships with its original English names. */
    example: {
      name: "Default Preset",
      grounding: "⛓️ Grounding",
      characterBehaviorValidator: "✅ Character Behavior Validator",
      proseRhythm: "✒️ Prose Rhythm",
      repetitionHammer: "🔨 Repetition Hammer",
    },
  },
};
