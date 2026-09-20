import { randomUUID } from "node:crypto";
import type { PromptBlock } from "../types.js";

const BLOCK_POSITIONS: PromptBlock["position"][] = ["system", "top", "in-chat", "post-history"];

/** Validates/normalizes the prompt-block list shared by the global settings and per-preset routes. */
export function parsePromptBlocks(value: unknown): PromptBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): PromptBlock | null => {
      if (typeof entry !== "object" || entry === null) return null;
      const e = entry as Record<string, unknown>;
      if (typeof e.name !== "string" || typeof e.content !== "string") return null;
      const role: PromptBlock["role"] = e.role === "user" || e.role === "assistant" ? e.role : "system";
      const position = BLOCK_POSITIONS.includes(e.position as PromptBlock["position"])
        ? (e.position as PromptBlock["position"])
        : "top";
      return {
        id: typeof e.id === "string" ? e.id : randomUUID(),
        name: e.name,
        content: e.content,
        enabled: e.enabled !== false,
        role,
        position,
        depth: position === "in-chat" && typeof e.depth === "number" ? e.depth : undefined,
      };
    })
    .filter((b): b is PromptBlock => b !== null);
}
