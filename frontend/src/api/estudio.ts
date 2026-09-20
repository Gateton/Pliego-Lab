import type { AddonsSettings } from "../types/addons";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getAddonsSettings(): Promise<AddonsSettings> {
  return fetch("/api/estudio/addons/settings").then((r) => asJson<AddonsSettings>(r));
}

export function updateAddonsSettings(settings: AddonsSettings): Promise<AddonsSettings> {
  return fetch("/api/estudio/addons/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<AddonsSettings>(r));
}
