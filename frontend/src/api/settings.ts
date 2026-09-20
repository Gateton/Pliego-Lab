import type { AppSettings } from "../types/settings";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getSettings(): Promise<AppSettings> {
  return fetch("/api/settings").then((r) => asJson<AppSettings>(r));
}

export function updateSettings(settings: AppSettings): Promise<AppSettings> {
  return fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<AppSettings>(r));
}

/**
 * Records that the first-run wizard / interface tour reached a given version. Separate call from
 * the main PUT on purpose: settings are edited from several components with their own snapshot, so
 * the onboarding flags must not travel inside that payload.
 */
export function markOnboarding(patch: { wizardVersion?: number; tourVersion?: number }): Promise<AppSettings> {
  return fetch("/api/settings/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((r) => asJson<AppSettings>(r));
}
