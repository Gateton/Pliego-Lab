import type { SamplingPreset } from "../types.js";
import { parsePromptBlocks } from "./promptBlocks.js";

function numOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function strOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boolOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

const EFFORT_LEVELS = ["auto", "low", "medium", "high"] as const;

function effortOrUndefined(value: unknown): "auto" | "low" | "medium" | "high" | undefined {
  return EFFORT_LEVELS.includes(value as (typeof EFFORT_LEVELS)[number])
    ? (value as "auto" | "low" | "medium" | "high")
    : undefined;
}

// Explicitly listing every key (even when undefined) ensures a cleared field
// actually overwrites the stored value instead of a spread-merge silently keeping it.
// The prompt fields are the exception: they are spread conditionally so a caller that doesn't
// send them (e.g. the Presets screen editing only sampling values) preserves the preset's own
// prompt blocks instead of wiping them.
export function parsePresetFields(body: Record<string, unknown>): Omit<SamplingPreset, "id" | "name"> {
  return {
    temperature: numOrUndefined(body.temperature),
    top_p: numOrUndefined(body.top_p),
    top_k: numOrUndefined(body.top_k),
    repetition_penalty: numOrUndefined(body.repetition_penalty),
    frequency_penalty: numOrUndefined(body.frequency_penalty),
    presence_penalty: numOrUndefined(body.presence_penalty),
    max_tokens: numOrUndefined(body.max_tokens),
    min_p: numOrUndefined(body.min_p),
    seed: numOrUndefined(body.seed),
    n: numOrUndefined(body.n),
    model: strOrUndefined(body.model),
    middleOut: body.middleOut === "allow" || body.middleOut === "forbid" ? body.middleOut : undefined,
    maxContextTokens: numOrUndefined(body.maxContextTokens),
    reasoningEnabled: boolOrUndefined(body.reasoningEnabled),
    reasoningEffort: effortOrUndefined(body.reasoningEffort),
    verbosity: effortOrUndefined(body.verbosity),
    squashSystemMessages: boolOrUndefined(body.squashSystemMessages),
    strictAlternation: boolOrUndefined(body.strictAlternation),
    ...(Array.isArray(body.promptBlocks) ? { promptBlocks: parsePromptBlocks(body.promptBlocks) } : {}),
    ...(typeof body.contextTemplate === "string" ? { contextTemplate: body.contextTemplate } : {}),
    ...(typeof body.contextTemplateEnabled === "boolean" ? { contextTemplateEnabled: body.contextTemplateEnabled } : {}),
  };
}
