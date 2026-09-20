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
