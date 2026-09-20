import type { NpcRecord, NpcTrackerSettings } from "../types/npcTracker";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getNpcTrackerSettings(): Promise<NpcTrackerSettings> {
  return fetch("/api/npc/settings").then((r) => asJson<NpcTrackerSettings>(r));
}

export function updateNpcTrackerSettings(settings: NpcTrackerSettings): Promise<NpcTrackerSettings> {
  return fetch("/api/npc/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<NpcTrackerSettings>(r));
}

export function scanChatNpcs(
  chatId: string,
  opts: { characterName?: string; personaName?: string; sinceIndex?: number } = {},
): Promise<{ npcs: NpcRecord[]; added: number; updated: number }> {
  return fetch(`/api/npc/scan/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).then((r) => asJson<{ npcs: NpcRecord[]; added: number; updated: number }>(r));
}

export function regenerateNpc(chatId: string, npcId: string, npcName: string): Promise<{ npc: NpcRecord }> {
  return fetch(`/api/npc/regenerate/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ npcId, npcName }),
  }).then((r) => asJson<{ npc: NpcRecord }>(r));
}

export function evolveChatNpcs(chatId: string, opts: { sinceIndex?: number } = {}): Promise<{ npcs: NpcRecord[]; changed: number }> {
  return fetch(`/api/npc/evolve/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).then((r) => asJson<{ npcs: NpcRecord[]; changed: number }>(r));
}

export function consolidateNpcField(chatId: string, npcId: string, fieldKey: string): Promise<{ npc: NpcRecord }> {
  return fetch(`/api/npc/consolidate/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ npcId, fieldKey }),
  }).then((r) => asJson<{ npc: NpcRecord }>(r));
}

export function generateNpcPortrait(imageTags: string): Promise<{ pfp: string }> {
  return fetch("/api/npc/portrait", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageTags }),
  }).then((r) => asJson<{ pfp: string }>(r));
}
