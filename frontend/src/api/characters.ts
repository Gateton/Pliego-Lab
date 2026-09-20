import type { CharacterCard, CharacterSummary } from "../types/character";
import { errorFromBody, responseError } from "./requestError";

export class CharacterGenerationError extends Error {
  readonly rawResponse: string;
  readonly reasoning: string;

  constructor(message: string, rawResponse: string, reasoning: string) {
    super(message);
    this.rawResponse = rawResponse;
    this.reasoning = reasoning;
    this.name = "CharacterGenerationError";
  }
}

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function listCharacters(): Promise<CharacterSummary[]> {
  return fetch("/api/characters").then((r) => asJson<CharacterSummary[]>(r));
}

export function getCharacter(id: string): Promise<CharacterCard> {
  return fetch(`/api/characters/${id}`).then((r) => asJson<CharacterCard>(r));
}

export function createCharacter(fields: Partial<CharacterCard> & { name: string }): Promise<CharacterCard> {
  return fetch("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<CharacterCard>(r));
}

export async function generateCharacter(input: {
  description: string;
  contextCharacterId?: string | null;
  isWorld?: boolean;
  draft?: Partial<CharacterCard> | null;
  refinement?: string;
}): Promise<{ fields: Omit<CharacterCard, "id"> }> {
  const response = await fetch("/api/characters/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { rawResponse?: unknown; reasoning?: unknown } | null;
    throw new CharacterGenerationError(
      errorFromBody(body, response.status).message,
      typeof body?.rawResponse === "string" ? body.rawResponse : "",
      typeof body?.reasoning === "string" ? body.reasoning : "",
    );
  }
  return response.json() as Promise<{ fields: Omit<CharacterCard, "id"> }>;
}

export function updateCharacter(id: string, fields: Partial<CharacterCard>): Promise<CharacterCard> {
  return fetch(`/api/characters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<CharacterCard>(r));
}

export function importPng(file: File): Promise<CharacterCard> {
  const form = new FormData();
  form.append("file", file);
  return fetch("/api/characters/import-png", { method: "POST", body: form }).then((r) => asJson<CharacterCard>(r));
}

export function importJson(file: File): Promise<CharacterCard> {
  const form = new FormData();
  form.append("file", file);
  return fetch("/api/characters/import-json", { method: "POST", body: form }).then((r) => asJson<CharacterCard>(r));
}

export function replaceImage(id: string, file: File): Promise<CharacterCard> {
  const form = new FormData();
  form.append("file", file);
  return fetch(`/api/characters/${id}/image`, { method: "PUT", body: form }).then((r) => asJson<CharacterCard>(r));
}

export async function deleteCharacter(id: string): Promise<void> {
  const response = await fetch(`/api/characters/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response);
  }
}

export function imageUrl(id: string): string {
  return `/api/characters/${id}/image`;
}

/**
 * Small, cached square of the card art for the slots that paint it at avatar size (library grid,
 * chat list, message avatars). `width` is the longest side in px; the backend snaps it to its own
 * steps, so pass the size the slot actually needs rather than something exact.
 *
 * Passing the summary's `mtimeMs` pins the URL to that revision of the file, which lets the browser
 * keep the thumbnail forever and still pick up a replaced image right away.
 */
export function thumbnailUrl(id: string, width: number, version?: number | null): string {
  const params = new URLSearchParams({ w: String(width) });
  if (version) params.set("v", String(version));
  return `/api/characters/${id}/image?${params.toString()}`;
}

export function generateGreeting(id: string): Promise<{ greeting: string }> {
  return fetch(`/api/characters/${id}/generate-greeting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => asJson<{ greeting: string }>(r));
}

export function translateGreeting(id: string): Promise<{ greeting: string }> {
  return fetch(`/api/characters/${id}/translate-greeting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => asJson<{ greeting: string }>(r));
}

export function generateImageTags(id: string): Promise<{ imageTags: string }> {
  return fetch(`/api/characters/${id}/generate-image-tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => asJson<{ imageTags: string }>(r));
}

export function exportUrl(id: string): string {
  return `/api/characters/${id}/export`;
}
