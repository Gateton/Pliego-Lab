// Port of comfyinject3.0/src/comfy.js — ComfyUI HTTP client. The seed passed in here is
// already fully resolved (RANDOM/LOCK/settings-level override all handled by the caller);
// this module only knows how to talk to ComfyUI.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ComfyInjectSettings } from "../../types.js";
import { enhancePrompt } from "./promptEnhancer.js";

const WORKFLOWS_DIR = path.resolve(process.cwd(), "assets", "comfy-workflows");
const POLL_INTERVAL_MS = 1000;
// Highest LORA_N_* slot any bundled/custom workflow could have — always filled (with empty/zero
// defaults past however many LoRAs are actually configured) so no workflow is ever left with an
// unresolved {{LORA_N_...}} placeholder. Raise this if a workflow with more LoraLoader nodes is
// ever added.
const LORA_FILL_CEILING = 20;

export class ComfyClientError extends Error {}

async function loadWorkflow(filename: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(WORKFLOWS_DIR, filename), "utf-8");
    return JSON.parse(raw);
  } catch {
    throw new ComfyClientError(`Failed to load workflow "${filename}"`);
  }
}

/** Fills all {{PLACEHOLDER}} tokens in the workflow with real values. Operates on a fresh copy. */
export function fillWorkflow(workflow: Record<string, unknown>, values: Record<string, unknown>): Record<string, unknown> {
  let workflowStr = JSON.stringify(workflow);
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `"{{${key}}}"`;
    const replacement = JSON.stringify(value);
    while (workflowStr.includes(placeholder)) {
      workflowStr = workflowStr.replace(placeholder, replacement);
    }
  }
  return JSON.parse(workflowStr);
}

interface WorkflowNode {
  class_type?: string;
  inputs?: Record<string, unknown>;
}

/**
 * Removes any LoraLoader node whose resolved lora_name is empty from the graph, rewiring
 * whatever other nodes read its model/clip outputs to read directly from its own model/clip
 * inputs instead — i.e. splices it out of the chain entirely.
 *
 * This is required, not cosmetic: ComfyUI's LoraLoader validates lora_name against the literal
 * list of installed lora files and has no "None"/passthrough option, so sending an empty string
 * for an unused slot makes ComfyUI reject the ENTIRE prompt (every output, not just that node) —
 * confirmed against a real generation attempt. An unused slot must not exist in the submitted
 * graph at all. Runs after fillWorkflow, on the already-filled (parsed) workflow object.
 */
function pruneEmptyLoraNodes(workflow: Record<string, unknown>): Record<string, unknown> {
  const nodes = workflow as Record<string, WorkflowNode>;

  for (;;) {
    const emptyId = Object.entries(nodes).find(
      ([, node]) => node.class_type === "LoraLoader" && node.inputs?.lora_name === "",
    )?.[0];
    if (!emptyId) break;

    const modelSource = nodes[emptyId].inputs?.model;
    const clipSource = nodes[emptyId].inputs?.clip;

    for (const node of Object.values(nodes)) {
      if (!node.inputs) continue;
      for (const [key, value] of Object.entries(node.inputs)) {
        if (Array.isArray(value) && value[0] === emptyId) {
          node.inputs[key] = value[1] === 1 ? clipSource : modelSource;
        }
      }
    }
    delete nodes[emptyId];
  }

  return nodes;
}

async function submitPrompt(workflow: Record<string, unknown>, host: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${host}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });
  } catch (error) {
    throw new ComfyClientError(`Could not reach ComfyUI at ${host}: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new ComfyClientError(`Failed to submit prompt: ${response.status}`);
  }
  const data = await response.json();
  if (!data.prompt_id) throw new ComfyClientError("ComfyUI response missing prompt_id");
  return data.prompt_id;
}

async function pollForResult(
  promptId: string,
  host: string,
  maxAttempts: number,
): Promise<{ filename: string; subfolder: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    let response: Response;
    try {
      response = await fetch(`${host}/history/${promptId}`);
    } catch {
      continue;
    }
    if (!response.ok) continue;

    const history = await response.json();
    const result = history[promptId];
    if (!result) continue;

    for (const nodeId of Object.keys(result.outputs ?? {})) {
      const images = result.outputs[nodeId]?.images;
      if (images && images.length > 0) {
        return { filename: images[0].filename, subfolder: images[0].subfolder ?? "" };
      }
    }
  }
  throw new ComfyClientError(`Timed out waiting for image after ${maxAttempts} attempts`);
}

function buildImageUrl(filename: string, subfolder: string, host: string): string {
  const params = new URLSearchParams({ filename, type: "output" });
  if (subfolder) params.set("subfolder", subfolder);
  return `${host}/view?${params.toString()}`;
}

export interface GenerateImageParams {
  prompt: string;
  ar: string;
  shot: string;
  seed: number;
  // Explicit width/height override — when both are set, this takes priority over the AR token's
  // configured resolution AND over resolution_lock, since it's a deliberate one-off choice (used
  // by the manual test tab; the normal [[IMG:...]] pipeline never sets this).
  width?: number;
  height?: number;
}

export interface GenerateImageResult {
  imageUrl: string;
  seed: number;
  prompt: string;
  effectiveAr: string;
  effectiveShot: string;
  effectiveWidth: number;
  effectiveHeight: number;
  // What actually went into the ComfyUI workflow, AFTER resolving the active style preset (if
  // any) and assembling prepend/shot-tag/append/enhancer into one string — surfaces exactly what
  // ran, since the preset override is otherwise invisible at generation time.
  effectiveCheckpoint: string;
  effectiveSampler: string;
  effectiveScheduler: string;
  effectiveLoras: ComfyInjectSettings["loras"];
  positivePrompt: string;
  activePresetName: string | null;
}

/** Overrides the base settings with the active style preset's values (style fields only). */
function applyActivePreset(settings: ComfyInjectSettings): ComfyInjectSettings {
  if (!settings.activePresetId) return settings;
  const preset = settings.presets?.find((p) => p.id === settings.activePresetId);
  if (!preset) return settings;
  return {
    ...settings,
    checkpoint: preset.checkpoint || settings.checkpoint,
    negative_prompt: preset.negative_prompt ?? settings.negative_prompt,
    prepend_prompt: preset.prepend_prompt ?? settings.prepend_prompt,
    append_prompt: preset.append_prompt ?? settings.append_prompt,
    steps: preset.steps ?? settings.steps,
    cfg: preset.cfg ?? settings.cfg,
    sampler: preset.sampler || settings.sampler,
    scheduler: preset.scheduler || settings.scheduler,
    denoise: preset.denoise ?? settings.denoise,
    loras: preset.loras ?? settings.loras,
  };
}

export async function generateImage(
  params: GenerateImageParams,
  settings: ComfyInjectSettings,
): Promise<GenerateImageResult> {
  const { prompt, ar, shot, seed, width, height } = params;
  const activePreset = settings.presets?.find((p) => p.id === settings.activePresetId) ?? null;
  settings = applyActivePreset(settings);

  const customResolution = width && height ? { width, height } : null;
  const resolution = customResolution ?? (settings.resolution_lock_enabled ? settings.resolution_lock : settings.resolutions[ar as keyof typeof settings.resolutions]);
  if (!resolution) throw new ComfyClientError(`Unknown AR token: ${ar}`);

  const effectiveShot = settings.shot_lock_enabled ? settings.shot_lock : shot;
  const shotTag = settings.shot_tags?.[effectiveShot] ?? "";
  const prepend = settings.prepend_prompt?.trim() ?? "";
  const append = settings.append_prompt?.trim() ?? "";
  let positivePrompt = [prepend, shotTag, prompt, append].filter(Boolean).join(", ");
  if (settings.enhancerEnabled) positivePrompt = enhancePrompt(positivePrompt);

  const workflow = await loadWorkflow(settings.workflow || "comfyinject_default.json");
  const loras = settings.loras ?? [];
  // fillWorkflow does a blind string replace — a placeholder with no matching key is left in the
  // JSON literally (as "{{LORA_N_NAME}}"), which ComfyUI would reject. So every LORA_N_* slot a
  // workflow could plausibly have (up to LORA_LORA_FILL_CEILING) must always get SOME value, not
  // just however many the user configured — unused slots fall back to the same empty/zero
  // defaults the previously-hardcoded 5-slot version always used (proven to be accepted by
  // ComfyUI's LoraLoader as "no lora" for that chain link).
  const loraValues: Record<string, unknown> = {};
  for (let i = 0; i < LORA_FILL_CEILING; i++) {
    loraValues[`LORA_${i + 1}_NAME`] = loras[i]?.name || "";
    loraValues[`LORA_${i + 1}_STRENGTH_MODEL`] = loras[i]?.strength_model ?? 0;
    loraValues[`LORA_${i + 1}_STRENGTH_CLIP`] = loras[i]?.strength_clip ?? 0;
  }
  const filled = pruneEmptyLoraNodes(
    fillWorkflow(workflow, {
      CHECKPOINT: settings.checkpoint,
      DIFFUSION_MODEL: settings.diffusion_model,
      TEXT_ENCODER: settings.text_encoder,
      VAE: settings.vae,
      POSITIVE_PROMPT: positivePrompt,
      NEGATIVE_PROMPT: settings.negative_prompt,
      WIDTH: resolution.width,
      HEIGHT: resolution.height,
      SEED: seed,
      STEPS: settings.steps,
      CFG: settings.cfg,
      SAMPLER: settings.sampler,
      SCHEDULER: settings.scheduler,
      DENOISE: settings.denoise,
      ...loraValues,
    }),
  );

  const promptId = await submitPrompt(filled, settings.comfy_host);
  const { filename, subfolder } = await pollForResult(promptId, settings.comfy_host, settings.max_poll_attempts ?? 180);
  const imageUrl = buildImageUrl(filename, subfolder, settings.comfy_host);

  return {
    imageUrl,
    seed,
    prompt,
    effectiveAr: customResolution ? "CUSTOM" : settings.resolution_lock_enabled ? "LOCKED" : ar,
    effectiveShot: settings.shot_lock_enabled ? "LOCKED" : shot,
    effectiveWidth: resolution.width,
    effectiveHeight: resolution.height,
    effectiveCheckpoint: settings.checkpoint,
    effectiveSampler: settings.sampler,
    effectiveScheduler: settings.scheduler,
    effectiveLoras: loras,
    positivePrompt,
    activePresetName: activePreset?.name ?? null,
  };
}

/**
 * Reads the list of valid values for a COMBO-type input on a ComfyUI node class, e.g.
 * `ckpt_name` on `CheckpointLoaderSimple` or `lora_name` on `LoraLoader`. ComfyUI's own web UI
 * uses this exact endpoint/shape to populate its node widget dropdowns. Never throws — an
 * unreachable host, a missing node class (a custom loader instead of the vanilla one), or an
 * unexpected response shape all just resolve to an empty list, since this is a convenience
 * feature (autocomplete), not a requirement.
 */
export async function fetchObjectInfoOptions(nodeClass: string, field: string, host: string): Promise<string[]> {
  if (!host) return [];
  try {
    const response = await fetch(`${host}/object_info/${nodeClass}`);
    if (!response.ok) return [];
    const data = await response.json();
    const options = data?.[nodeClass]?.input?.required?.[field]?.[0];
    return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
  } catch {
    return [];
  }
}
