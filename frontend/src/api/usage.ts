import type { UsageEvent } from "../types/usage";
import { responseError } from "./requestError";

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export function getUsageEvents(): Promise<UsageEvent[]> {
  return fetch("/api/usage").then((r) => asJson<UsageEvent[]>(r));
}
