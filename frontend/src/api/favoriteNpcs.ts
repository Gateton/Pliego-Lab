import type { NpcRecord } from "../types/npcTracker";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getFavoriteNpcs(): Promise<NpcRecord[]> {
  return fetch("/api/favorite-npcs").then((r) => asJson<NpcRecord[]>(r));
}

export function addFavoriteNpc(npc: Omit<NpcRecord, "id">): Promise<NpcRecord> {
  return fetch("/api/favorite-npcs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(npc),
  }).then((r) => asJson<NpcRecord>(r));
}

export function removeFavoriteNpc(id: string): Promise<void> {
  return fetch(`/api/favorite-npcs/${id}`, { method: "DELETE" }).then((r) => {
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
  });
}
