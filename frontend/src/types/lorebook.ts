export type LorebookPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LorebookEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: 0 | 1 | 2 | 3;
  addMemo: boolean;
  order: number;
  position: LorebookPosition;
  disable: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
  delayUntilRecursion: number;
  probability: number;
  useProbability: boolean;
  depth: number;
  outletName: string;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: 0 | 1 | 2;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  characterFilter?: { isExclude?: boolean; names?: string[]; tags?: string[] };
  triggers: string[];
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  entries: Record<string, LorebookEntry>;
  extensions: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  source?: "native" | "sillytavern" | "character";
}

export interface LorebookSettings {
  enabled: boolean;
  globalLorebookIds: string[];
  scanDepth: number;
  minActivations: number;
  minActivationsDepthMax: number;
  budgetPercent: number;
  budgetCap: number;
  recursive: boolean;
  maxRecursionSteps: number;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  useGroupScoring: boolean;
  characterStrategy: 0 | 1 | 2;
  includeNames: boolean;
  scanNpcBank: boolean;
  scanVisualState: boolean;
}

export interface LorebookScanResult {
  before: string[];
  after: string[];
  authorNoteBefore: string[];
  authorNoteAfter: string[];
  exampleBefore: string[];
  exampleAfter: string[];
  atDepth: Array<{ content: string; depth: number; role: "system" | "user" | "assistant" }>;
  outlets: Record<string, string[]>;
  trace: Array<{ lorebookId: string; lorebookName: string; uid: number; comment: string; status: string; reason: string; matchedKey?: string; tokenEstimate: number; source: string }>;
  usedTokens: number;
  budgetTokens: number;
  overflowed: boolean;
}
