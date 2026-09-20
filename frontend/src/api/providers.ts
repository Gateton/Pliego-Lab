import type { ModelDescriptor, ProviderId, ProviderSummary } from "../types/provider";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function listProviders(): Promise<ProviderSummary[]> {
  return fetch("/api/providers").then((r) => asJson<ProviderSummary[]>(r));
}

export function setActiveProvider(providerId: ProviderId): Promise<ProviderSummary> {
  return fetch("/api/providers/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId }),
  }).then((r) => asJson<ProviderSummary>(r));
}

export function updateProvider(
  providerId: ProviderId,
  patch: { baseUrl?: string },
): Promise<ProviderSummary> {
  return fetch(`/api/providers/${providerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => asJson<ProviderSummary>(r));
}

export async function setProviderKey(providerId: ProviderId, apiKey: string): Promise<void> {
  const response = await fetch(`/api/providers/${providerId}/key`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  await asJson<unknown>(response);
}

export async function deleteProviderKey(providerId: ProviderId): Promise<void> {
  const response = await fetch(`/api/providers/${providerId}/key`, { method: "DELETE" });
  if (!response.ok) {
    throw await responseError(response);
  }
}

export function testProvider(providerId: ProviderId, model?: string): Promise<{ ok: boolean; reply?: string; error?: string }> {
  return fetch(`/api/providers/${providerId}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  }).then((r) => r.json());
}

export function listProviderModels(providerId: ProviderId): Promise<ModelDescriptor[]> {
  return fetch(`/api/providers/${providerId}/models`).then((r) => asJson<ModelDescriptor[]>(r));
}

export function generateTitle(characterName: string, text: string): Promise<{ title: string | null }> {
  return fetch("/api/generate-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterName, text }),
  }).then((r) => asJson<{ title: string | null }>(r));
}
