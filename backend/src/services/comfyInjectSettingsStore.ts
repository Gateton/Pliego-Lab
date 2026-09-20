import type { ComfyInjectSettings } from "../types.js";
import { createJsonObjectStore } from "./jsonObjectStore.js";

const DEFAULT_SETTINGS: ComfyInjectSettings = {
  enabled: false,
  comfy_host: "http://127.0.0.1:8188",
  checkpoint: "",
  workflow: "pliego_lab_excample.json",
  diffusion_model: "realismByStableYogi_v30INT4Extended.safetensors",
  text_encoder: "qwen3vl_4b_fp8_scaled.safetensors",
  vae: "qwen_image_vae.safetensors",
  negative_prompt: "worst quality, low quality, blurry, deformed, ugly, extra limbs",
  prepend_prompt: "",
  append_prompt: "",
  steps: 24,
  cfg: 7.0,
  sampler: "euler",
  scheduler: "normal",
  denoise: 1.0,
  max_poll_attempts: 180,
  resolutions: {
    PORTRAIT: { width: 512, height: 768 },
    SQUARE: { width: 512, height: 512 },
    LANDSCAPE: { width: 768, height: 512 },
    CINEMA: { width: 768, height: 432 },
  },
  resolution_lock_enabled: false,
  resolution_lock: { width: 512, height: 768 },
  shot_lock_enabled: false,
  shot_lock: "MEDIUM",
  seed_lock_enabled: false,
  seed_lock_mode: "RANDOM",
  seed_lock_value: 0,
  shot_tags: {
    CLOSE: "close-up, face focus",
    MEDIUM: "upper body",
    WIDE: "full body",
    DUTCH: "dutch angle",
    OVERHEAD: "from above, bird's eye view",
    LOWANGLE: "from below",
    HIGHANGLE: "from above",
    PROFILE: "profile, from side",
    BACKVIEW: "from behind",
    POV: "pov",
  },
  loras: [
    { name: "", strength_model: 1.0, strength_clip: 1.0 },
    { name: "", strength_model: 1.0, strength_clip: 1.0 },
    { name: "", strength_model: 1.0, strength_clip: 1.0 },
    { name: "", strength_model: 1.0, strength_clip: 1.0 },
    { name: "", strength_model: 1.0, strength_clip: 1.0 },
  ],
  customDirectiveEnabled: false,
  customDirective: "",
  presets: [],
  activePresetId: null,
  enhancerEnabled: false,
  directorMode: false,
};

const store = createJsonObjectStore<ComfyInjectSettings>("comfyInjectSettings.json", DEFAULT_SETTINGS);

export const getComfyInjectSettings = store.get;
export const updateComfyInjectSettings = store.update;
