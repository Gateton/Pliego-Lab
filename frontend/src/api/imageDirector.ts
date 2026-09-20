import type { ModelDescriptor } from "../types/provider";
import type { CharacterVisualState, DirectorStateUpdate, ImageDirectorSettings } from "../types/imageDirector";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export interface DirectorContext {
  character?: { name: string; description: string; personality: string; scenario: string; imageTags: string };
  npcs?: Array<{ name: string; values: Record<string, string> }>;
  persona?: { name: string; imageTags: string };
  recentMessages?: Array<{ role: string; content: string }>;
  visualState?: Record<string, CharacterVisualState>;
  chatId?: string;
}

export function getImageDirectorSettings(): Promise<ImageDirectorSettings> {
  return fetch("/api/image-director/settings").then((r) => asJson<ImageDirectorSettings>(r));
}

export function updateImageDirectorSettings(settings: ImageDirectorSettings): Promise<ImageDirectorSettings> {
  return fetch("/api/image-director/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<ImageDirectorSettings>(r));
}

export function runImageDirector(
  text: string,
  context?: DirectorContext,
  signal?: AbortSignal,
): Promise<{
  taggedText: string;
  stateUpdates: DirectorStateUpdate[];
  diagnostic: { response: string; reasoning: string };
}> {
  return fetch("/api/image-director/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...context }),
    signal,
  }).then((r) => asJson<{ taggedText: string; stateUpdates: DirectorStateUpdate[]; diagnostic: { response: string; reasoning: string } }>(r));
}

export function checkVisualState(
  text: string,
  context?: DirectorContext,
  signal?: AbortSignal,
): Promise<{ stateUpdates: DirectorStateUpdate[] }> {
  return fetch("/api/image-director/check-visual-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...context }),
    signal,
  }).then((r) => asJson<{ stateUpdates: DirectorStateUpdate[] }>(r));
}

export function listImageDirectorModels(): Promise<ModelDescriptor[]> {
  return fetch("/api/image-director/models").then((r) => asJson<ModelDescriptor[]>(r));
}

export function runDirectorReaction(
  npc: { name: string; values: Record<string, string> },
  lastMessageText: string,
  chatId?: string,
): Promise<{ marker: string }> {
  return fetch("/api/image-director/react", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ npc, lastMessageText, chatId }),
  }).then((r) => asJson<{ marker: string }>(r));
}
