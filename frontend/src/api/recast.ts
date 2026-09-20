import type { RecastPreset, RecastSettings } from "../types/recast";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getSettings(): Promise<RecastSettings> {
  return fetch("/api/recast/settings").then((r) => asJson<RecastSettings>(r));
}

export function updateSettings(settings: RecastSettings): Promise<RecastSettings> {
  return fetch("/api/recast/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<RecastSettings>(r));
}

export function listPresets(): Promise<RecastPreset[]> {
  return fetch("/api/recast/presets").then((r) => asJson<RecastPreset[]>(r));
}

export function createPreset(fields: { name: string; passes: RecastPreset["passes"] }): Promise<RecastPreset> {
  return fetch("/api/recast/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<RecastPreset>(r));
}

export function updatePreset(id: string, fields: { name: string; passes: RecastPreset["passes"] }): Promise<RecastPreset> {
  return fetch(`/api/recast/presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<RecastPreset>(r));
}

export async function deletePreset(id: string): Promise<void> {
  const response = await fetch(`/api/recast/presets/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response);
  }
}

export interface RecastPassPayload {
  passId: string;
  model?: string;
  systemPrompt: string;
  userPrefix: string;
  sceneContextMessages?: { role: "user" | "assistant"; content: string }[];
}

export function process(text: string, passes: RecastPassPayload[], chatId?: string): Promise<{ text: string; snapshots: string[] }> {
  return fetch("/api/recast/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, passes, chatId }),
  }).then((r) => asJson<{ text: string; snapshots: string[] }>(r));
}
