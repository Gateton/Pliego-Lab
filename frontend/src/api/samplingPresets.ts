import type { SamplingPreset } from "../types/samplingPreset";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function listSamplingPresets(): Promise<SamplingPreset[]> {
  return fetch("/api/sampling-presets").then((r) => asJson<SamplingPreset[]>(r));
}

export function createSamplingPreset(fields: Omit<SamplingPreset, "id">): Promise<SamplingPreset> {
  return fetch("/api/sampling-presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<SamplingPreset>(r));
}

export function updateSamplingPreset(id: string, fields: Omit<SamplingPreset, "id">): Promise<SamplingPreset> {
  return fetch(`/api/sampling-presets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then((r) => asJson<SamplingPreset>(r));
}

export async function deleteSamplingPreset(id: string): Promise<void> {
  const response = await fetch(`/api/sampling-presets/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response);
  }
}

/**
 * Imports one or more presets from a JSON file the user picked. `data` is the parsed file and
 * `name` is the file name without extension, used when a preset carries no name of its own
 * (SillyTavern completion presets usually do not).
 */
export function importSamplingPresets(name: string, data: unknown): Promise<{ imported: SamplingPreset[]; errors: string[] }> {
  return fetch("/api/sampling-presets/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
  }).then((r) => asJson<{ imported: SamplingPreset[]; errors: string[] }>(r));
}
