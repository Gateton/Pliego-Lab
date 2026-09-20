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

export interface ComfyInjectLora {
  name: string;
  strength_model: number;
  strength_clip: number;
}

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

export interface TestGenerateResult {
  imageUrl: string;
  seed: number;
  prompt: string;
  effectiveAr: string;
  effectiveShot: string;
  effectiveWidth: number;
  effectiveHeight: number;
  effectiveCheckpoint: string;
  effectiveSampler: string;
  effectiveScheduler: string;
  effectiveLoras: ComfyInjectLora[];
  positivePrompt: string;
  activePresetName: string | null;
}

export interface ComfyInjectSettings {
  enabled: boolean;
  comfy_host: string;
  checkpoint: string;
  workflow: string;
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
  customDirectiveEnabled: boolean;
  customDirective: string;
  presets: StylePreset[];
  activePresetId: string | null;
  enhancerEnabled: boolean;
  directorMode: boolean;          // when true, don't inject image prompt into main model
}
