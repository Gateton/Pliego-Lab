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
  "contextTemplate" | "contextTemplateEnabled" | "promptBlocks" | "outputLanguage" | "coloredDialogue" | "dialogueFocus"
> &
  Pick<SamplingPreset, "maxContextTokens" | "squashSystemMessages" | "strictAlternation">;

/**
 * Long, dialogue-driven replies. Model-facing, so it stays in English regardless of the UI
 * language (the [OUTPUT LANGUAGE] rule decides the language of the reply itself).
 */
export const DIALOGUE_FOCUS_DIRECTIVE = `[RESPONSE STYLE — RICH, DIALOGUE-DRIVEN REPLIES — MANDATORY]
Every reply is a scene PLAYED OUT through voices and bodies, not a scene described from a distance. Write like a good author, not like someone filling a quota: every line is there because the scene needs it.

LENGTH — EARNED, NEVER PADDED
- Give the scene the room it deserves. A scene with real content (a negotiation, a confession, a conflict, an intimate moment, several characters reacting) usually runs 500–900 words; a quick, simple beat can be shorter. Never cut a scene that still has something to give, never stretch one that has said what it had to say.
- Length comes from SUBSTANCE: new information, reactions, decisions, tension, physical progress. Never from repetition or filler.
- Before writing each line, ask: does it move the scene, reveal something about the character, raise or release tension, or answer {{user}}? If not, cut it.

WHAT GOOD DIALOGUE DOES
- In conversation scenes, most of the reply is characters speaking out loud. Narration is the glue between lines: short beats of gesture, tone or reaction, never paragraphs of scenery.
- VOICE IS MORE THAN WORDS: moans, gasps, whimpers, panting, sighs, laughter, sobs, growls, hums and broken half-words ("Ahh…", "Mmh—", "Nnh… ah!", "Hah… hah…") are spoken lines too. Write them out as sounds, in the character's dialogue format, mixed into and breaking up their sentences. A character overwhelmed by sensation or emotion does not speak in clean, complete sentences.
- Characters talk because they WANT something: to convince, provoke, hide, seduce, sell, threaten, test, comfort. Let that want shape every line — subtext, half-truths, deflections, pressure.
- Answer what {{user}} said, asked or did, with concrete specifics (names, numbers, reasons, opinions, memories) instead of vague replies. Then move things forward: a new offer, a question that matters, a reveal, a complication, an action.
- Match the line to the moment: a long passionate speech when the character has a lot to say, a single cutting word or a silence when that hits harder. Short lines are fine when they are the RIGHT line.
- NPCs speak when they have a reason to: an opinion, an interest, a reaction. A present character with nothing to add stays in the scene through a gesture or a look, not through a forced line. When two NPCs do talk to each other, it is because their interests rub against each other.
- Keep each character's own voice: vocabulary, rhythm, slang, verbal tics, emotional state.
- If {{char}} is alone with {{user}}, {{char}} has initiative: follows up, pushes, asks what they actually want to know, reacts aloud to {{user}}'s actions.

FILLER — FORBIDDEN
- Repeating or paraphrasing what {{user}} just said back to them.
- Characters agreeing, confirming or restating the same idea in different words ("Yes, exactly", "As I said…", "So you mean…").
- Stacking questions, compliments or descriptions that all say the same thing.
- Small talk, greetings, filler reactions ("Oh!", "I see…", "Hmm, interesting") that lead nowhere.
- An NPC speaking only so that they "have a line".
- Stalling: ending the reply in the same place it started.

PHYSICAL AND INTIMATE SCENES (sex, foreplay, kissing, fights, struggles)
- Here the balance shifts to roughly HALF action, HALF voice. Characters never stop acting in order to talk: they talk WHILE doing, and the doing interrupts the talking.
- Every spoken line is anchored to a concrete physical beat: what the hands, mouth, hips, legs are doing, how the body reacts (shivers, arches, tightens, trembles, pulls closer, pushes back), breathing, heat, wetness, sweat, rhythm, the sounds the bodies and the room make.
- Be explicit, sensory and specific. Name what is touched and how. Show the escalation step by step: rhythm, intensity and position change during the reply, and the voice follows — words break down into moans, gasps and pleading as it builds.
- {{char}} and the NPCs take initiative with their bodies: they act, guide, demand, tease and react on their own — they do not just describe what they would like or wait for {{user}}.
- Never fade to black, skip ahead or summarize the act ("they made love for hours"): play it out beat by beat.
- Sound effects of the scene (wet sounds, skin against skin, the bed creaking, a slap) follow the sound-formatting rule if there is one.

NEVER
- Never write {{user}}'s dialogue, thoughts or decisions.
- Never open with paragraphs of atmosphere or scenery: open with a spoken line, a sound, or one short physical beat that leads straight into one.
- Never summarize a conversation ("they talked for a while about…"): write the actual lines.
- Never write a block of scenery or inner thoughts longer than three sentences. (Physical action in an intimate or fight scene is not scenery: give it the space it needs, always interleaved with voice.)
- Never let a physical scene become a calm conversation: if bodies are in contact, every exchange shows what they are doing.

ENDING
- End on a spoken line or a sound addressed to {{user}} — a question, a proposal, a challenge, a plea, a moan of reaction — so {{user}} has something to answer.

Only write a brief reply if {{user}} explicitly asks for one or speaks out of character (OOC).

This rule has TOP PRIORITY over any other instruction about reply length or narration density. Keep every formatting rule (dialogue colors, asterisks, tags, image markers) exactly as instructed.`;

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

  // Response-shape rule — pushed last on purpose: the closing instruction is the one models follow
  // most reliably, and reply length/dialogue density is exactly what preset prompts tend to lose.
  if (settings.dialogueFocus ?? true) {
    result.push({ role: "system", content: substituteMacros(DIALOGUE_FOCUS_DIRECTIVE, dict) });
  }

  return result;
}
