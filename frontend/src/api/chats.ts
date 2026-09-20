import type { Chat, ChatMessage, ChatSummary } from "../types/chat";
import type { CharacterVisualState } from "../types/imageDirector";
import type { NpcRecord } from "../types/npcTracker";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function listChats(): Promise<ChatSummary[]> {
  return fetch("/api/chats").then((r) => asJson<ChatSummary[]>(r));
}

export function createChat(opts: { characterId?: string; personaId?: string; title?: string } = {}): Promise<Chat> {
  return fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).then((r) => asJson<Chat>(r));
}

export function getChat(id: string): Promise<Chat> {
  return fetch(`/api/chats/${id}`).then((r) => asJson<Chat>(r));
}

export function updateChat(
  id: string,
  patch: {
    title: string;
    messages: ChatMessage[];
    extensionData?: Record<string, unknown>;
    npcs?: NpcRecord[];
    npcTracker?: Chat["npcTracker"];
    personaId?: string | null;
    variables?: Record<string, string>;
    visualState?: Record<string, CharacterVisualState>;
  },
): Promise<Chat> {
  return fetch(`/api/chats/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => asJson<Chat>(r));
}

export function renameChat(id: string, title: string): Promise<Chat> {
  return fetch(`/api/chats/${id}/rename`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  }).then((r) => asJson<Chat>(r));
}

export async function deleteChat(id: string): Promise<void> {
  const response = await fetch(`/api/chats/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response);
  }
}
