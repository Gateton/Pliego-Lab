import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const SETTINGS_PATH = path.resolve(process.cwd(), "data", "settings.json");
const PRESETS_PATH = path.resolve(process.cwd(), "data", "samplingPresets.json");

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, filePath);
}

/**
 * One-time migration: folds the legacy prompt content (per-preset systemPrompt / jailbreak /
 * extraPrompts, plus the old global systemPromptDefault / jailbreakDefault) into the new
 * global `settings.promptBlocks` list. Idempotent — no-op once `promptBlocks` exists.
 */
export async function migratePrompts(): Promise<void> {
  const settings = await readJson<Record<string, unknown>>(SETTINGS_PATH);
  if (!settings) return; // no settings yet → nothing to migrate
  if (Array.isArray(settings.promptBlocks)) return; // already migrated

  const presets = (await readJson<Record<string, unknown>[]>(PRESETS_PATH)) ?? [];
  const activeId = settings.activeSamplingPresetId;
  const active = presets.find((p) => p.id === activeId);

  const blocks: Array<Record<string, unknown>> = [];
  const push = (name: unknown, role: unknown, content: unknown, position: string, enabled: boolean, depth?: unknown) => {
    if (typeof content !== "string" || !content.trim()) return;
    const block: Record<string, unknown> = {
      id: randomUUID(),
      name: typeof name === "string" && name.trim() ? name : "Prompt",
      role: role === "user" || role === "assistant" ? role : "system",
      content,
      enabled,
      position,
    };
    if (position === "in-chat" && typeof depth === "number") block.depth = depth;
    blocks.push(block);
  };

  const legacySystemPrompt = (active?.systemPrompt as string)?.trim()
    ? (active?.systemPrompt as string)
    : ((settings.systemPromptDefault as string) ?? "");
  const legacyJailbreak = (active?.jailbreak as string)?.trim()
    ? (active?.jailbreak as string)
    : ((settings.jailbreakDefault as string) ?? "");

  push("System prompt", "system", legacySystemPrompt, "system", true);
  for (const ep of (active?.extraPrompts as Array<Record<string, unknown>>) ?? []) {
    const position = ep.position === "in-chat" ? "in-chat" : "top";
    push(ep.name, ep.role, ep.content, position, ep.enabled !== false, ep.depth);
  }
  push("Jailbreak", "system", legacyJailbreak, "post-history", true);

  const nextSettings: Record<string, unknown> = {
    ...settings,
    promptBlocks: blocks,
    contextTemplateEnabled: settings.contextTemplateEnabled ?? true,
    defaultPersonaId: settings.defaultPersonaId ?? null,
  };
  delete nextSettings.systemPromptDefault;
  delete nextSettings.jailbreakDefault;
  await writeJson(SETTINGS_PATH, nextSettings);

  if (presets.length) {
    const nextPresets = presets.map(({ systemPrompt, jailbreak, extraPrompts, ...rest }) => rest);
    await writeJson(PRESETS_PATH, nextPresets);
  }
}
