import type { ChatMessage as StreamMessage, ContentPart } from "../api/chatStream";
import type { Chat } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { Persona } from "../types/persona";
import type { AppSettings } from "../types/settings";
import type { SamplingPreset } from "../types/samplingPreset";
import type { LorebookScanResult } from "../types/lorebook";
import { buildBaseDict, resolveOverridable, substituteMacros, type MacroDict } from "./macros";
import { compactImagesForOutbound, stripImageMarkers } from "./comfyOutbound";
import { trimToTokenBudget } from "./contextBudget";

/**
 * What buildPrompt needs: the global prompt/UI settings plus the active preset's context
 * shaping. The preset is the single source for generation-related values (context budget,
 * system-message squashing, strict alternation) — see lib/presetDefaults.
 */
export type PromptSettings = Pick<
  AppSettings,
  "contextTemplate" | "contextTemplateEnabled" | "promptBlocks" | "outputLanguage" | "coloredDialogue"
> &
  Pick<SamplingPreset, "maxContextTokens" | "squashSystemMessages" | "strictAlternation">;

function contentToParts(content: StreamMessage["content"]): ContentPart[] {
  return typeof content === "string" ? [{ type: "text", text: content }] : content;
}

/** Merges consecutive messages whose role satisfies `predicate` into one, concatenating content. */
function mergeConsecutive(messages: StreamMessage[], predicate: (role: StreamMessage["role"]) => boolean): StreamMessage[] {
  const result: StreamMessage[] = [];
  for (const m of messages) {
    const prev = result[result.length - 1];
    if (prev && prev.role === m.role && predicate(m.role)) {
      if (typeof prev.content === "string" && typeof m.content === "string") {
        prev.content = `${prev.content}\n\n${m.content}`;
      } else {
        prev.content = [...contentToParts(prev.content), { type: "text", text: "\n\n" }, ...contentToParts(m.content)];
      }
    } else {
      result.push({ ...m });
    }
  }
  return result;
}

/**
 * Builds the full messages[] array sent to the LLM. Prompt content comes from the global
 * `settings.promptBlocks` list (the prompt manager), grouped by `position`:
 *   - "system"       → fills `{{system}}` in the context template (the system prompt)
 *   - "top"          → its own message, right after the context/system message
 *   - "in-chat"      → spliced into the history at `depth` from the end
 *   - "post-history" → appended after the history (the jailbreak)
 * */
export function buildPrompt(
  chat: Chat,
  character: CharacterCard | null,
  persona: Persona | null,
  settings: PromptSettings,
  excludeMessageIds: Set<string>,
  extraMacros: MacroDict = {},
  stripImageTags = false,
  lorebook?: LorebookScanResult | null,
): StreamMessage[] {
  const dict = {
    memory: "",
    engine: "",
    globalToggles: "",
    addons: "",
    npcTracker: "",
    comfyInject: "",
    pluma: "",
    ...buildBaseDict(character, persona),
    ...(chat.variables ?? {}),
    ...extraMacros,
  };
  const messages: StreamMessage[] = [];

  const enabledBlocks = (settings.promptBlocks ?? []).filter((b) => b.enabled && b.content.trim());

  const systemContent = enabledBlocks
    .filter((b) => b.position === "system")
    .map((b) => substituteMacros(b.content, dict))
    .join("\n\n");
  const topBlocks = enabledBlocks.filter((b) => b.position === "top");
  const inChatBlocks = enabledBlocks.filter((b) => b.position === "in-chat");
  const postHistoryContent = enabledBlocks
    .filter((b) => b.position === "post-history")
    .map((b) => substituteMacros(b.content, dict))
    .join("\n\n");

  const hasSystemContent = character !== null || systemContent.trim() !== "";
  if (hasSystemContent && settings.contextTemplateEnabled) {
    const systemPrompt = character
      ? resolveOverridable(character.system_prompt, systemContent, dict)
      : substituteMacros(systemContent, dict);

    const contextMessage = substituteMacros(settings.contextTemplate, { ...dict, system: systemPrompt }).trim();
    if (contextMessage) messages.push({ role: "system", content: contextMessage });
  }

  for (const b of topBlocks) {
    messages.push({ role: b.role, content: substituteMacros(b.content, dict) });
  }

  // ComfyInject's marker-syntax directive (native) — independent of Roleplay and of the prompt
  // blocks: it applies whenever ComfyInject itself is enabled.
  if (dict.comfyInject.trim()) messages.push({ role: "system", content: substituteMacros(dict.comfyInject.trim(), dict) });

  // Roleplay system blocks (native) — unconditional, same pattern as before.
  if (dict.memory.trim()) messages.push({ role: "system", content: substituteMacros(dict.memory.trim(), dict) });
  if (dict.pluma.trim()) messages.push({ role: "system", content: substituteMacros(dict.pluma.trim(), dict) });
  if (dict.engine.trim()) messages.push({ role: "system", content: substituteMacros(dict.engine.trim(), dict) });
  if (dict.globalToggles.trim()) messages.push({ role: "system", content: substituteMacros(dict.globalToggles.trim(), dict) });
  if (dict.addons.trim()) messages.push({ role: "system", content: substituteMacros(dict.addons.trim(), dict) });
  if (dict.npcTracker.trim()) messages.push({ role: "system", content: substituteMacros(dict.npcTracker.trim(), dict) });

  // SillyTavern-compatible World Info positions around the character/context region.
  const loreBefore = [...(lorebook?.before ?? []), ...(lorebook?.authorNoteBefore ?? []), ...(lorebook?.exampleBefore ?? [])].join("\n\n");
  const loreAfter = [...(lorebook?.after ?? []), ...(lorebook?.exampleAfter ?? []), ...(lorebook?.authorNoteAfter ?? [])].join("\n\n");
  if (loreBefore.trim()) messages.push({ role: "system", content: loreBefore });
  if (loreAfter.trim()) messages.push({ role: "system", content: loreAfter });

  const historyMessages = chat.messages.filter((m) => !excludeMessageIds.has(m.id));
  const trimmedHistory = trimToTokenBudget(historyMessages, (m) => m.swipes[m.activeSwipeIndex], settings.maxContextTokens ?? 8000);
  for (const m of trimmedHistory) {
    const raw = m.swipes[m.activeSwipeIndex];
    const compacted = compactImagesForOutbound(raw, m.images, m.activeSwipeIndex);
    const content = stripImageTags ? stripImageMarkers(compacted) : compacted;
    messages.push({ role: m.role, content: substituteMacros(content, dict) });
  }

  // Lorebook at-depth entries count from the end of the assembled history.
  for (const injection of lorebook?.atDepth ?? []) {
    const insertAt = Math.max(0, messages.length - Math.max(0, injection.depth));
    messages.splice(insertAt, 0, { role: injection.role, content: injection.content });
  }

  // "in-chat" blocks spliced at a depth counted from the end (0 = right after the last message).
  for (const b of inChatBlocks) {
    const depth = Math.max(0, b.depth ?? 0);
    const insertAt = Math.max(0, messages.length - depth);
    messages.splice(insertAt, 0, { role: b.role, content: substituteMacros(b.content, dict) });
  }

  const postHistory = character
    ? resolveOverridable(character.post_history_instructions, postHistoryContent, dict)
    : substituteMacros(postHistoryContent, dict);
  if (postHistory.trim()) messages.push({ role: "system", content: postHistory });

  let result = settings.squashSystemMessages ? mergeConsecutive(messages, (role) => role === "system") : messages;
  if (settings.strictAlternation) result = mergeConsecutive(result, () => true);

  // Native output-language override — pushed AFTER the squash/strict merge so it always stays
  // the very last instruction, never fused into the jailbreak/system block. Applies regardless
  // of Roleplay or the active preset.
  const outputLanguage = settings.outputLanguage?.trim();
  if (outputLanguage) {
    result.push({
      role: "system",
      content: `[OUTPUT LANGUAGE]\nAlways write your entire response in ${outputLanguage}. This overrides every other language instruction. Keep all formatting rules, HTML tags, [[IMG:...]] markers, and structure from your instructions exactly as they are — only the language of the narration, dialogue and descriptions becomes ${outputLanguage}. The content inside [[IMG:...]] tags stays in English.`,
    });
  }

  // Global dialogue-format rule — always injected (like the language override) so the model
  // consistently wraps spoken dialogue in <font color> tags. Model-facing text, not UI copy, so it
  // stays in English no matter which interface language the user picked.
  if (settings.coloredDialogue) {
    result.push({
      role: "system",
      content: `[DIALOGUE FORMAT — MANDATORY]\nNEVER use em dashes (—) or bare quotes for dialogue. Everything a character says out loud MUST always go inside <font color="#HEX">, preceded by the character's name. Assign every character ONE fixed hex color and reuse it in all of their lines.\n\nEXACT format (the only allowed way to write dialogue):\nName: <font color="#HEX">"What the character says."</font>\n\nNarration and descriptions stay in plain text, without color or quotes. Internal thoughts go in *single asterisks*. This rule has TOP PRIORITY and overrides any other dialogue-format instruction, including any that suggest dashes or bare quotes.`,
    });
  }

  return result;
}
