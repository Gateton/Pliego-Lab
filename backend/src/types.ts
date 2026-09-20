import type { NormalizedUsage, ProviderId } from "./services/providers/types.js";

export type GeneratedImageResult =
  | {
      status: "ok";
      url: string;
      seed: number;
      prompt: string;
      ar: string;
      shot: string;
      rawMarker: string;
      checkpoint: string;
      loras: ComfyInjectLora[];
    }
  | { status: "parse_error"; reason: string; rawMarker: string }
  | { status: "generation_error"; reason: string; rawMarker: string };

export type UsageStage =
  | "main"
  | "director"
  | "recast"
  | "npcTracker"
  | "memory"
  | "memoryPlus"
  | "characterGen";

export interface UsageEvent extends NormalizedUsage {
  id: string;
  chatId: string | null;
  stage: UsageStage;
  provider: ProviderId;
  model: string;
  timestamp: number;
  /** Legacy fields — present only on events recorded before usage was normalized. */
  promptTokens?: number;
  completionTokens?: number;
}

export interface TurnEventChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface TurnEventDetail {
  kind: "npc_added" | "npc_evolved" | "visual_state";
  npcName?: string;
  changes: TurnEventChange[];
}

export interface TurnEvent {
  text: string;
  detail?: TurnEventDetail;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  swipes: string[];
  activeSwipeIndex: number;
  createdAt: number;
  images?: Record<string, GeneratedImageResult>;
  recast?: RecastData;
  reasonings?: string[];
  personaAvatar?: string;
  // Permanent log of automatic background events tied to this turn (new NPC detected, an NPC
  // evolved, a visual-state change) — a record the user can scroll back to, never auto-cleared.
  // Entries can be a bare string (legacy) or a TurnEvent (current shape, with click-for-detail).
  events?: Array<string | TurnEvent>;
}

export interface RecastData {
  prefix: string;
  original: string;
  transformed: string;
  snapshots: string[];
  passNames: string[];
}

export interface VisualStateHistoryEntry {
  timestamp: number;
  summary: string;
}

export interface CharacterVisualState {
  outfit: string;
  state: string[];
  updatedAt: number;
  history?: VisualStateHistoryEntry[];
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  characterId: string | null;
  personaId: string | null;
  messages: ChatMessage[];
  extensionData?: Record<string, unknown>;
  npcs?: NpcRecord[];
  npcTracker?: { lastScannedCount: number; lastEvolvedCount?: number };
  variables?: Record<string, string>;
  visualState?: Record<string, CharacterVisualState>;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
  characterId: string | null;
  messageCount: number;
  lastMessagePreview: string;
}

export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  tags: string[];
  imageTags: string;
  creator: string;
  character_version: string;
  /** SillyTavern/Character Card V2 embedded lorebook, preserved losslessly. */
  character_book?: Record<string, unknown>;
  /** Library lorebooks linked to this character. */
  lorebookIds?: string[];
  // True for a "world"/scenario card (a whole setting, not a person) — excludes it from
  // NPC Tracker's includeMainCharacter entirely, regardless of the global toggle, since a
  // world has no physical appearance/secrets/mannerisms to track.
  isWorld?: boolean;
}

export interface CharacterSummary {
  id: string;
  name: string;
  tags: string[];
  addedAt: number;
  /**
   * mtime of the card PNG. The interface pins avatar URLs to it (`?v=`) so the browser can cache
   * thumbnails forever while still noticing a replaced image immediately.
   */
  mtimeMs: number;
  isWorld?: boolean;
  /** True for cards shipped by Pliego Lab rather than created or imported by the user. */
  isSystem?: boolean;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  // Same shape/keys as NpcRecord.values (NpcTrackerSettings.fields) — lets a favorited persona
  // be dropped straight into another chat's NPC roster with no field remapping.
  values?: Record<string, string>;
  lorebookId?: string | null;
}

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
  // Response/context shaping that used to live in AppSettings — now part of the preset so a
  // preset fully describes "how the model responds", with no second source of truth.
  maxContextTokens?: number;
  reasoningEnabled?: boolean;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
  verbosity?: "auto" | "low" | "medium" | "high";
  squashSystemMessages?: boolean;
  strictAlternation?: boolean;
  promptBlocks?: PromptBlock[];
  contextTemplate?: string;
  contextTemplateEnabled?: boolean;
}

export interface PromptBlock {
  id: string;
  name: string;
  role: "system" | "user" | "assistant";
  content: string;
  enabled: boolean;
  position: "system" | "top" | "in-chat" | "post-history";
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

export interface ComfyInjectLora {
  name: string;
  strength_model: number;
  strength_clip: number;
}

/** A named style bundle that overrides the base generation settings at render time. */
export interface StylePreset {
  id: string;
  name: string;
  checkpoint: string;
  negative_prompt: string;
  prepend_prompt: string;
  append_prompt: string;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
  loras: ComfyInjectLora[];
}

export type AspectRatioToken = "PORTRAIT" | "SQUARE" | "LANDSCAPE" | "CINEMA";

export interface ComfyInjectSettings {
  enabled: boolean;
  comfy_host: string;
  checkpoint: string;
  workflow: string;
  // DiT (Krea 2 / FLUX-style) models loaded via UNETLoader + CLIPLoader + VAELoader instead
  // of CheckpointLoaderSimple. Only consulted by workflows that contain those node types;
  // SD/SDXL workflows (CheckpointLoaderSimple) ignore them.
  diffusion_model: string;
  text_encoder: string;
  vae: string;
  negative_prompt: string;
  prepend_prompt: string;
  append_prompt: string;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
  max_poll_attempts: number;
  resolutions: Record<AspectRatioToken, { width: number; height: number }>;
  resolution_lock_enabled: boolean;
  resolution_lock: { width: number; height: number };
  shot_lock_enabled: boolean;
  shot_lock: string;
  seed_lock_enabled: boolean;
  seed_lock_mode: "RANDOM" | "LOCK" | "CUSTOM";
  seed_lock_value: number;
  shot_tags: Record<string, string>;
  loras: ComfyInjectLora[];
  // The instruction that teaches the *main roleplay model* the [[IMG:...]] marker syntax —
  // unlike everything else in this settings object, this is prompt content, not image-gen
  // config. Real SillyTavern users have to hand-write this inside a preset's own prompt (it's
  // the only reason ComfyInject-style markers ever get written at all); this is the same
  // "Advanced: Edit Prompts, disabled means defaults are used" pattern Roleplay's own subsystems
  // use, so ComfyInject has a working default with zero setup instead of depending on whatever
  // the active preset happens to contain.
  customDirectiveEnabled: boolean;
  customDirective: string;
  presets: StylePreset[];
  activePresetId: string | null;
  enhancerEnabled: boolean;
  directorMode: boolean;
}

export interface RecastPass {
  id: string;
  name: string;
  enabled: boolean;
  contextLength: number;
  prompt: string;
  model?: string;
  includeCharCard: boolean;
  includeSceneContext: boolean;
}

export interface RecastPreset {
  id: string;
  name: string;
  passes: RecastPass[];
}

export interface RecastSettings {
  enabled: boolean;
  autoRun: boolean;
  activePresetId: string | null;
  minChars: number;
  sceneContextAsRoles: boolean;
}

export interface ImageDirectorSettings {
  enabled: boolean;
  model: string;
  maxImagesPerTurn: number;
  instructionPrompt: string;
  jailbreakEnabled: boolean;
  jailbreakPrompt: string;
  triggerMode: "auto" | "manual";
  includeCharacterContext: boolean;
  includePersonaContext: boolean;
  contextDepth: number;
  temperature: number;
  top_p: number;
  max_tokens: number;
  thinkingEffort: "off" | "auto" | "low" | "medium" | "high";
  minTagsPerImage: number;          // 0 = no minimum enforced
  directorTimeoutSeconds: number;   // how long the frontend waits before giving up on a call
}

export interface DirectorStateUpdate {
  character: string;
  outfitChanged: boolean;
  newOutfit?: string;
  stateAdded?: string[];
  stateRemoved?: string[];
}

export interface PlumaRule {
  id: string;
  enabled: boolean;
  title: string;
  instruction: string;
  example: string;
}

export interface PlumaSettings {
  enabled: boolean;
  rules: PlumaRule[];
}

export interface Addon {
  id: string;
  name: string;
  trigger: string;
  content: string;
  /** Short explanation shown in the UI instead of the prompt (built-in packs hide `content`). */
  description?: string;
  exclusive?: string;
  rolls?: number;
  builtin?: boolean;
}

export interface AddonsSettings {
  enabled: boolean;
  activeAddonIds: string[];
  addons: Addon[];
}

export type NpcFieldKind = "text" | "textarea" | "tags";

export interface NpcField {
  key: string;
  label: string;
  kind: NpcFieldKind;
  builtin?: boolean;
  // True for fields the Character Card already covers (appearance, personality, role,
  // background, imageTags) — never written for an isMainCharacter NPC entry, so the
  // protagonist's identity never has two competing sources in the same prompt.
  sharedWithCharacterCard?: boolean;
  // How evolveNpcDossiers applies a model-reported update to this field:
  // "append" — the model may only report NEW content to add; the code concatenates it onto
  //   the existing value (tags fields dedupe), so the model can never delete established
  //   permanent facts, no matter how it behaves.
  // "replace" (default when unset, matches pre-existing behavior) — a "current state/snapshot"
  //   field (e.g. current motivation) where the model reports the full new value and it fully
  //   replaces the old one.
  evolveMode?: "append" | "replace";
}

export interface NpcRecord {
  id: string;
  name: string;
  values: Record<string, string>;
  pfp?: string;
  firstSeen?: number;
  // True when this entry is the chat's own {{char}}, included via NpcTrackerSettings.includeMainCharacter.
  isMainCharacter?: boolean;
}

export interface NpcTrackerSettings {
  enabled: boolean;
  autoScan: boolean;
  autoScanInterval: number;
  heuristicScan: boolean;
  includeMainCharacter: boolean;
  evolutionEnabled: boolean;
  evolutionInterval: number;
  model: string;
  fields: NpcField[];
}
