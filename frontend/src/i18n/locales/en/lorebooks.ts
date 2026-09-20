/**
 * Lorebooks: entries, activation, editor.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const lorebooks = {
  title: "Lorebooks",
  subtitle: "The living knowledge of your worlds. Compatible with SillyTavern World Info.",
  emptySelection: "Pick or create a lorebook to get started.",
  /** Default memo of a new entry: it seeds the entry data, and the user can edit it. */
  newEntryMemo: "New entry",
  /**
   * Labels and words shown by more than one part of the studio: the engine settings and the
   * per-entry advanced panel, the entry list and the book overview, and the character editor.
   */
  shared: {
    scanDepth: "Scan depth",
    alwaysActive: "Always active",
    entry: "entry",
    entries: "entries",
  },
  /** Actions of this screen that are not shared with another one. */
  action: {
    duplicateName: "{name} — copy",
    duplicate: "Duplicate",
  },
  toolbar: {
    settings: "Settings",
    importSt: "Import ST",
    newBook: "New lorebook",
  },
  saveState: {
    saved: "Saved",
    auto: "Autosave",
  },
  settings: {
    heading: "Engine settings",
    description: "Imported books keep ST behavior. Native sources are opt-in.",
    activation: "Activation",
    engine: "Lorebook engine",
    engineHint: "Turning it off returns the prompt to its previous behavior.",
    recursive: "Recursive scanning",
    wholeWords: "Whole words by default",
    caseSensitive: "Case sensitive by default",
    budget: "Budget",
    budgetPercent: "Context budget (%)",
    budgetCap: "Absolute token limit",
    budgetCapHint: "0 means no extra limit.",
    sgContext: "Pliego Lab context",
    npcBank: "Read NPC Bank",
    npcBankHint: "Lets entries activate from dossiers. Read-only; it does not change NPC Tracker.",
    visualState: "Read visual state",
    visualStateHint: "Uses outfit and persistent conditions as activation context.",
    includeNames: "Include names when scanning the chat",
  },
  library: {
    heading: "Library",
    create: "Create lorebook",
    searchPlaceholder: "Search worlds…",
    noMatches: "We could not find that world.",
    empty: "Your library is ready for its first world.",
    clearSearch: "Clear search",
    globalBadge: "Global",
  },
  entries: {
    heading: "Entries",
    create: "Create entry",
    searchPlaceholder: "Memo, keyword, content…",
    untitled: "Entry {uid}",
    noKeywords: "No keywords",
    empty: "This book has no entries yet.",
    createFirst: "Create the first one",
  },
  editor: {
    /** Field name of the World Info format: the same in both languages. */
    uid: "UID",
    statusDisabled: "Disabled",
    statusConstant: "Constant",
    statusKeywords: "By keywords",
    /** Appended to the memo when an entry is duplicated. */
    copySuffix: "copy",
    removeKeyword: "Remove keyword",
    memo: "Memo",
    memoHint: "A name to find this entry. It is not sent to the model.",
    active: "Active",
    primaryKeywords: "Primary keywords",
    keywordsHint: "Enter or comma to add. Click a keyword to remove it.",
    keywordPlaceholder: "dragon, kingdom, /regex/i…",
    secondaryKeywords: "Secondary keywords",
    secondaryKeywordPlaceholder: "Additional condition…",
    content: "Content",
    contentHint: "Inserted into the prompt when the entry activates. It supports macros such as {{char}}, {{user}}, {{npc_bank}} and {{visual_state}}.",
    position: "Position",
    order: "Order",
    orderHint: "Higher is evaluated first.",
    probability: "Probability",
    advanced: "Advanced settings",
    depth: "Injection depth",
    scanDepthHint: "Empty uses the global value.",
    inclusionGroup: "Inclusion group",
    groupWeight: "Group weight",
    sticky: "Sticky (messages)",
    cooldown: "Cooldown (messages)",
    ignoreBudget: "Ignore budget",
    preventRecursion: "Do not trigger recursion",
    excludeRecursion: "Exclude from recursion",
    groupOverride: "Group priority",
    scanDescription: "Scan character description",
    scanPersonality: "Scan personality",
    scanScenario: "Scan scenario",
    scanPersona: "Scan persona",
    vectorized: "This entry is marked as vectorized. The field is kept for compatibility, but Pliego Lab does not run embeddings.",
  },
  /** SillyTavern insertion positions, in the order the format defines them. */
  position: {
    beforeChar: "Before character",
    afterChar: "After character",
    authorNoteTop: "Author's Note · top",
    authorNoteBottom: "Author's Note · bottom",
    atDepth: "At depth",
    examplesTop: "Examples · top",
    examplesBottom: "Examples · bottom",
    outlet: "Outlet",
  },
  /** Selective logic operators of the World Info format: the tokens are the same in both languages. */
  logic: {
    andAny: "AND ANY",
    andAll: "AND ALL",
    notAny: "NOT ANY",
    notAll: "NOT ALL",
  },
  book: {
    nameAria: "Lorebook name",
    descriptionPlaceholder: "What knowledge does this world hold?",
    activeCount: "active",
    constantCount: "constant",
    globalOn: "Globally active",
    globalOff: "Enable globally",
    exportSt: "Export for ST",
    guideTitle: "Build the world entry by entry",
    guideText: "Select “+” in the middle column. Use constants for permanent rules and keywords to reveal knowledge when the story needs it.",
  },
  newBook: {
    promptTitle: "New lorebook name",
    defaultName: "New world",
  },
  confirm: {
    deleteBook: "Delete “{name}”? Links to it will simply stop using it.",
    deleteEntry: "Delete the entry “{name}”?",
  },
  error: {
    openLibrary: "The library could not be opened",
    save: "Could not save",
    settings: "The settings could not be saved",
    import: "Could not import",
    delete: "The lorebook could not be deleted",
  },
};
