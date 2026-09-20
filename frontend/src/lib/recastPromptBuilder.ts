import type { Chat, ChatMessage } from "../types/chat";
import type { CharacterCard } from "../types/character";
import type { Persona } from "../types/persona";
import type { RecastPreset, RecastSettings } from "../types/recast";
import type { RecastPassPayload } from "../api/recast";
import { buildBaseDict, substituteMacros, type MacroDict } from "./macros";
import { compactImagesForOutbound } from "./comfyOutbound";

/** The `contextLength` messages immediately before `targetMessageId` (never including it). */
export function sliceHistory(chat: Chat, targetMessageId: string, contextLength: number): ChatMessage[] {
  const idx = chat.messages.findIndex((m) => m.id === targetMessageId);
  const end = idx === -1 ? chat.messages.length : idx;
  return chat.messages.slice(Math.max(0, end - contextLength), end);
}

export function buildCharactersXml(character: CharacterCard | null, dict: MacroDict): string {
  if (!character) return "";
  const lines = [
    character.name && `Name: ${character.name}`,
    character.description?.trim() && `Description: ${substituteMacros(character.description, dict)}`,
    character.personality?.trim() && `Personality: ${substituteMacros(character.personality, dict)}`,
    character.scenario?.trim() && `Scenario: ${substituteMacros(character.scenario, dict)}`,
    character.mes_example?.trim() && `Example dialogue: ${substituteMacros(character.mes_example, dict)}`,
  ].filter(Boolean);
  return lines.length ? `<characters>\n${lines.join("\n")}\n</characters>` : "";
}

export function buildSceneContextText(lines: { name: string; content: string }[]): string {
  if (!lines.length) return "";
  return `<scene_context>\n${lines.map((l) => `${l.name}: ${l.content}`).join("\n")}\n</scene_context>`;
}

export function buildRecastPasses(
  preset: RecastPreset,
  recastSettings: RecastSettings,
  chat: Chat,
  targetMessageId: string,
  character: CharacterCard | null,
  persona: Persona | null,
): RecastPassPayload[] {
  const dict = buildBaseDict(character, persona);

  return preset.passes
    .filter((p) => p.enabled)
    .map((pass): RecastPassPayload => {
      const charactersXml = pass.includeCharCard ? buildCharactersXml(character, dict) : "";
      let sceneContextXml = "";
      let sceneContextMessages: RecastPassPayload["sceneContextMessages"];

      if (pass.includeSceneContext && pass.contextLength > 0) {
        const resolved = sliceHistory(chat, targetMessageId, pass.contextLength).map((m) => ({
          role: m.role,
          name: m.role === "user" ? persona?.name || "User" : character?.name || "Assistant",
          content: substituteMacros(
            compactImagesForOutbound(m.swipes[m.activeSwipeIndex], m.images, m.activeSwipeIndex),
            dict,
          ),
        }));

        if (recastSettings.sceneContextAsRoles) {
          sceneContextMessages = resolved.map((r) => ({ role: r.role, content: r.content }));
        } else {
          sceneContextXml = buildSceneContextText(resolved);
        }
      }

      return {
        passId: pass.id,
        model: pass.model?.trim() || undefined,
        systemPrompt: substituteMacros(pass.prompt, dict),
        userPrefix: [charactersXml, sceneContextXml].filter(Boolean).join("\n\n"),
        sceneContextMessages,
      };
    });
}
