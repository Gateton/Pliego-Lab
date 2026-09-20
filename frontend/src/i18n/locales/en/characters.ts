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
    discard: "Discard",
    delete: "Delete",
    edit: "Edit",
    generating: "Generating…",
    remove: "Remove",
    saving: "Saving…",
  },
  /** Character Card V2 field labels, shared by the creator, the editor and the persona form. */
  card: {
    creator: "Creator",
    creatorNotes: "Creator notes",
    description: "Description",
    dialogueExamples: "Dialogue examples",
    firstMessage: "First message",
    firstMessageGreeting: "First message / Greeting",
    imageTags: "Image tags",
    imageTagsDanbooru: "Image tags (Danbooru)",
    name: "Name",
    personality: "Personality",
    postHistoryInstructions: "Post-history instructions",
    postHistoryInstructionsJailbreak: "Post-history instructions / jailbreak",
    scenario: "Scenario",
    systemPrompt: "System prompt",
    tags: "Tags",
    version: "Version",
  },
  creator: {
    title: "Character Creator",
    description: "Describe an idea and generate a complete Character Card. Review everything before saving it.",
    idea: {
      label: "What character do you want to create?",
      hint: "Describe it with as much detail as you like: backstory, personality, looks, relationships, conflict and tone.",
      placeholder: "E.g.: A veteran commander of a besieged city, hardened by war but protective of the civilians…",
    },
    context: {
      title: "Reference context",
      optional: "Optional",
      description: "Pick an existing character, world or scenario. The AI will use it as context so the new character fits that universe.",
      remove: "Remove context",
      world: "World / scenario",
      character: "Character",
      reference: "It will be used as a reference for the universe",
      change: "Change",
      searchCta: "Search for a character or world",
      searchHint: "You can use any card as context",
      available: "{count} available",
      searchPlaceholder: "Search by name or tag…",
      noMatches: "No matches found.",
      filter: {
        all: "All",
        characters: "Characters",
        worlds: "Worlds",
      },
    },
    worldToggle: {
      label: "Create world/scenario",
      hint: "Check this if the card describes a place, era, faction or narrative setting.",
    },
    image: {
      alt: "Preview",
      empty: "No image",
      upload: "Upload PNG image",
      needTags: "Generate the card first to get image tags",
      generateHint: "Generate a portrait with ComfyInject",
      generating: "Generating with ComfyInject…",
      generate: "Generate with ComfyInject",
    },
    generate: "Generate character",
    errorDetails: "See the raw answer and reasoning",
    draft: {
      title: "Generated draft",
      description: "Review and edit every field. Nothing is saved yet.",
    },
    changes: {
      title: "Changes in this generation",
      field: "field",
      fields: "fields",
      hint: "The highlighted fields were added or changed by the AI. Open each one to compare the exact content.",
      new: "New",
      changed: "Changed",
      before: "Before",
      empty: "(empty)",
      notice: "The AI changed this field in the last generation",
    },
    tagsHint: "Comma-separated.",
    refine: {
      label: "Refinement mode",
      hint: "Write what you want to improve. The AI gets this draft and returns a complete new version.",
      placeholder: "E.g.: Make it less heroic, more contradictory and fit the selected world better.",
      action: "Refine character",
      busy: "Refining…",
    },
    save: {
      action: "Save character",
      hint: "It will be saved in the format of your imported characters.",
    },
    diagnosis: {
      title: "Generation diagnostics",
      description: "Here you can review the reasoning the provider exposed and the exact response Pliego Lab received.",
      reasoningTitle: "Model reasoning",
      reasoningEmpty: "The provider returned no visible reasoning for this generation.",
      responseTitle: "Exact response received",
      responseEmpty: "The provider returned no visible content.",
    },
    /** Hints of the generated draft fields. The labels come from `card`. */
    hint: {
      creatorNotes: "Useful information for you, it is not sent to the model during the chat.",
      description: "Who they are, their looks, backstory and key traits.",
      dialogueExamples: "Samples of voice, style and turns of phrase.",
      imageTags: "Visual tags in English to keep the appearance consistent.",
      personality: "Temperament, wants, limits, contradictions and how they think.",
      postHistoryInstructions: "Instructions applied after the chat history.",
      scenario: "Where the story starts and what is happening right now.",
      firstMessage: "The opening message it will use when a chat starts.",
      systemPrompt: "Private behavior rules for this character.",
    },
    error: {
      pngRequired: "The image has to be a PNG to stay compatible with Character Cards.",
      generate: "The character could not be generated.",
      image: "The image could not be generated with ComfyInject.",
      portraitDownload: "The generated portrait could not be downloaded to save it.",
      nameRequired: "The character needs a name before saving.",
      save: "The character could not be saved.",
    },
  },
  editor: {
    title: "Editing {name}",
    description: "These fields build the card the model reads on every message. The clearer they are, the more consistent the character stays.",
    changeImage: "Change image",
    worldToggle: {
      label: "This is a world/scenario, not a person",
      hint: "Check this for characters like 'an island', 'a city', a general scenario, and so on — it will never be tracked as an NPC/main character in NPC Tracker even if you have 'Include main character' enabled, because a world has no physical appearance, secrets or mannerisms to record.",
    },
    greeting: {
      label: "Greeting",
      translate: "Translate greeting",
      translating: "Translating…",
      regenerate: "Regenerate greeting",
      generatedNotice: "Generated greeting — not applied until you use it:",
      use: "Use this greeting",
      translatedNotice: "Translated greeting — not applied until you use it:",
      useTranslation: "Use this translation",
    },
    imageTags: {
      generate: "Generate tags with AI",
      generatedNotice: "Generated tags — not applied until you use them:",
      use: "Use these tags",
    },
    knowledge: {
      title: "Knowledge",
      description: "Linked lorebooks are looked up automatically in every chat with this character.",
      embeddedTitle: "Embedded lorebook",
      embeddedHint: "It came inside the Character Card and travels with it when you export it.",
      libraryLabel: "Library lorebooks",
      libraryHint: "The first one acts as the main book. You can link several without duplicating their entries.",
      empty: "There are no lorebooks in your library yet. Create them from the Lorebooks button in the top bar.",
    },
    tagsHint: "Comma-separated. They are used to search and filter characters.",
    /** Hints of the editor fields. The labels come from `card`. */
    hint: {
      creatorNotes: "Information only, it is not sent to the model.",
      description: "Who they are: appearance, backstory, key traits. It always goes into the prompt.",
      dialogueExamples: "Samples of how they speak, so the model imitates the style.",
      imageTags: "The character's appearance as Danbooru tags (hair, eyes, skin, body). The AI uses them as the base for every generated image.",
      personality: "Short summary of temperament and way of speaking.",
      postHistoryInstructions: "Injected after the message history, right before the response.",
      scenario: "The context/place where the story starts.",
      firstMessage: "The first thing the character says when a new chat starts.",
      systemPrompt: "Overrides the global system prompt for this character only. Leave it empty to use the default.",
    },
    error: {
      greetingGenerate: "Could not generate the greeting",
      greetingTranslate: "Could not translate the greeting",
      tagsGenerate: "Could not generate the tags",
    },
  },
};
