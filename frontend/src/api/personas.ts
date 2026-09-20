import type { Persona } from "../types/persona";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function listPersonas(): Promise<Persona[]> {
  return fetch("/api/personas").then((r) => asJson<Persona[]>(r));
}

export function createPersona(fields: { name: string; description: string; avatar?: string; values?: Record<string, string>; lorebookId?: string | null }): Promise<Persona> {
  return fetch("/api/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<Persona>(r));
}

export function updatePersona(
  id: string,
  fields: { name: string; description: string; avatar?: string; values?: Record<string, string>; lorebookId?: string | null },
): Promise<Persona> {
  return fetch(`/api/personas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<Persona>(r));
}

/** Generates a full dossier (same field schema as NPC Tracker) from a free-text sketch —
 * deliberately not tied to a persisted persona, so it works before the user has saved. */
export function generatePersonaDossier(description: string): Promise<{ values: Record<string, string> }> {
  return fetch("/api/personas/generate-dossier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  }).then((r) => asJson<{ values: Record<string, string> }>(r));
}

export async function deletePersona(id: string): Promise<void> {
  const response = await fetch(`/api/personas/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response);
  }
}
