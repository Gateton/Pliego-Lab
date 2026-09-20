import type { ComfyInjectSettings, GeneratedImageResult, TestGenerateResult } from "../types/comfyInject";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

/**
 * Square-sized version of a generated picture, for the slots that crop it anyway (the chat gallery).
 * The chat itself keeps the original URL: there the picture is the illustration.
 */
export function imageThumbnailUrl(url: string, width: number): string {
  return `${url}?w=${width}`;
}

export function getSettings(): Promise<ComfyInjectSettings> {
  return fetch("/api/comfyinject/settings").then((r) => asJson<ComfyInjectSettings>(r));
}

export function updateSettings(settings: ComfyInjectSettings): Promise<ComfyInjectSettings> {
  return fetch("/api/comfyinject/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<ComfyInjectSettings>(r));
}

export function listWorkflows(): Promise<string[]> {
  return fetch("/api/comfyinject/workflows").then((r) => asJson<string[]>(r));
}

export function listCheckpoints(): Promise<string[]> {
  return fetch("/api/comfyinject/checkpoints").then((r) => asJson<string[]>(r));
}

export function listDiffusionModels(): Promise<string[]> {
  return fetch("/api/comfyinject/diffusion-models").then((r) => asJson<string[]>(r));
}

export function listTextEncoders(): Promise<string[]> {
  return fetch("/api/comfyinject/text-encoders").then((r) => asJson<string[]>(r));
}

export function listVaes(): Promise<string[]> {
  return fetch("/api/comfyinject/vaes").then((r) => asJson<string[]>(r));
}

export function listLoras(): Promise<string[]> {
  return fetch("/api/comfyinject/loras").then((r) => asJson<string[]>(r));
}

export function processMessage(text: string, chatId: string, beforeMessageId: string): Promise<GeneratedImageResult[]> {
  return fetch("/api/comfyinject/process-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, chatId, beforeMessageId }),
  }).then((r) => asJson<GeneratedImageResult[]>(r));
}

export function retryMarker(rawMarker: string, chatId: string, beforeMessageId: string): Promise<GeneratedImageResult> {
  return fetch("/api/comfyinject/retry-marker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawMarker, chatId, beforeMessageId }),
  }).then((r) => asJson<GeneratedImageResult>(r));
}

export function generateMarker(rawMarker: string, chatId: string, beforeMessageId: string): Promise<GeneratedImageResult> {
  return fetch("/api/comfyinject/generate-marker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawMarker, chatId, beforeMessageId }),
  }).then((r) => asJson<GeneratedImageResult>(r));
}

export function testGenerate(
  prompt: string,
  ar: string,
  shot: string,
  seed?: number,
  resolution?: { width: number; height: number },
): Promise<TestGenerateResult> {
  return fetch("/api/comfyinject/test-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, ar, shot, seed, ...(resolution ?? {}) }),
  }).then((r) => asJson<TestGenerateResult>(r));
}
