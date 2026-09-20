import type { PromptBlock, SamplingPreset } from "../types.js";

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

interface RawPrompt {
  identifier?: string;
  name?: string;
  content?: string;
  role?: string;
  marker?: boolean;
  injection_position?: number;
  injection_depth?: number;
  enabled?: boolean;
}

function roleOf(raw: RawPrompt): PromptBlock["role"] {
  return raw.role === "user" || raw.role === "assistant" ? raw.role : "system";
}

export interface ParsedCompletionPreset {
  preset: Omit<SamplingPreset, "id">;
}

/**
 * Maps ANY SillyTavern Chat Completion preset JSON into our shape — generic, not tied to a
 * specific community preset. Sampling fields keep the same external key names ST itself saves
 * (confirmed against real installed presets); `prompts[]` becomes the preset's OWN
 * `promptBlocks` (`main` → system, `jailbreak` → post-history, others → top/in-chat by injection
 * position). If the preset carries a `prompt_manager`, its active `context_template` is imported
 * too. injection_order/injection_trigger/forbid_overrides are dropped — we don't have the World
 * Info/group-chat conflict space those exist to arbitrate.
 */
export function parseCompletionPreset(raw: Record<string, unknown>, name: string): ParsedCompletionPreset {
  const prompts = Array.isArray(raw.prompts) ? (raw.prompts as RawPrompt[]) : [];

  const promptBlocks: PromptBlock[] = [];

  for (const p of prompts) {
    if (p.marker || typeof p.content !== "string" || !p.content.trim()) continue;
    let position: PromptBlock["position"] = "top";
    if (p.identifier === "main") position = "system";
    else if (p.identifier === "jailbreak") position = "post-history";
    else if (p.injection_position === 1) position = "in-chat";

    const defaultName =
      p.identifier === "main" ? "System prompt" : p.identifier === "jailbreak" ? "Jailbreak" : "Prompt importado";

    promptBlocks.push({
      id: p.identifier || `imported_${promptBlocks.length}`,
      name: p.name || defaultName,
      content: p.content,
      enabled: p.enabled !== false,
      role: roleOf(p),
      position,
      depth: position === "in-chat" ? (num(p.injection_depth) ?? 0) : undefined,
    });
  }

  // Legacy `prompts[]` presets carry no context template (the "main" block IS the system prompt).
  // Newer presets may ship a `prompt_manager` whose active entry has a `context_template`.
  let contextTemplate: string | undefined;
  const pm = raw.prompt_manager as Record<string, unknown> | undefined;
  if (pm && typeof pm === "object") {
    const activeKey = typeof pm.active_preset === "string" ? pm.active_preset : "main";
    const active = pm[activeKey] as Record<string, unknown> | undefined;
    if (active && typeof active.context_template === "string") contextTemplate = active.context_template;
  }

  return {
    preset: {
      name,
      temperature: num(raw.temperature),
      top_p: num(raw.top_p),
      top_k: num(raw.top_k),
      repetition_penalty: num(raw.repetition_penalty),
      frequency_penalty: num(raw.frequency_penalty),
      presence_penalty: num(raw.presence_penalty),
      max_tokens: num(raw.openai_max_tokens),
      min_p: num(raw.min_p),
      seed: num(raw.seed),
      n: num(raw.n),
      model: typeof raw.openrouter_model === "string" ? raw.openrouter_model : undefined,
      promptBlocks,
      ...(contextTemplate !== undefined ? { contextTemplate, contextTemplateEnabled: true } : {}),
    },
  };
}
