import type { PromptBlock } from "./settings";

export type Effort = "auto" | "low" | "medium" | "high";

/** A preset fully describes how the model responds: model + sampling + context/reasoning/compat. */
export interface SamplingPreset {
  id: string;
  name: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  min_p?: number;
  seed?: number;
  n?: number;
  model?: string;
  middleOut?: "auto" | "allow" | "forbid";
  maxContextTokens?: number;
  reasoningEnabled?: boolean;
  reasoningEffort?: Effort;
  verbosity?: Effort;
  squashSystemMessages?: boolean;
  strictAlternation?: boolean;
  promptBlocks?: PromptBlock[];
  contextTemplate?: string;
  contextTemplateEnabled?: boolean;
}
