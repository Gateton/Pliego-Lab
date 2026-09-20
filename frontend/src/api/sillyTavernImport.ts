import type { ApplyResult, ScannedPersona, ScanResult } from "../types/sillyTavernImport";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getConfig(): Promise<{ sillyTavernPath: string | null }> {
  return fetch("/api/import/config").then((r) => asJson(r));
}

export function setConfig(sillyTavernPath: string): Promise<{ sillyTavernPath: string; users: string[] }> {
  return fetch("/api/import/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sillyTavernPath }),
  }).then((r) => asJson(r));
}

export function scan(user?: string): Promise<ScanResult> {
  const qs = user ? `?user=${encodeURIComponent(user)}` : "";
  return fetch(`/api/import/scan${qs}`).then((r) => asJson<ScanResult>(r));
}

export function apply(selection: {
  user: string;
  characters: string[];
  presets: string[];
  personas: ScannedPersona[];
  lorebooks: string[];
}): Promise<ApplyResult> {
  return fetch("/api/import/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  }).then((r) => asJson<ApplyResult>(r));
}
