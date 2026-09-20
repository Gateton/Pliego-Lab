export type PromptBlockRole = "system" | "user" | "assistant";
export type PromptBlockPosition = "system" | "top" | "in-chat" | "post-history";

export interface PromptBlock {
  id: string;
  name: string;
  role: PromptBlockRole;
  content: string;
  enabled: boolean;
  position: PromptBlockPosition;
  depth?: number;
}

export interface AppSettings {
  contextTemplate: string;
  contextTemplateEnabled: boolean;
  promptBlocks: PromptBlock[];
  defaultPersonaId: string | null;
  activeSamplingPresetId: string | null;
  streaming: boolean;
  chatFontSize: number;
  chatImageSize: number;
  density: "comfortable" | "compact";
  outputLanguage: string;
  coloredDialogue: boolean;
  favoriteCharacterIds: string[];
  /** Onboarding bookkeeping, versioned so bumping a constant re-shows it. null = never seen. */
  onboardingWizardVersion: number | null;
  onboardingTourVersion: number | null;
}
