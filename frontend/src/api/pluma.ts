import type { PlumaSettings } from "../types/pluma";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getPlumaSettings(): Promise<PlumaSettings> {
  return fetch("/api/pluma/settings").then((r) => asJson<PlumaSettings>(r));
}

export function updatePlumaSettings(settings: PlumaSettings): Promise<PlumaSettings> {
  return fetch("/api/pluma/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).then((r) => asJson<PlumaSettings>(r));
}
