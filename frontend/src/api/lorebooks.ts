import type { Chat } from "../types/chat";
import type { Lorebook, LorebookScanResult, LorebookSettings } from "../types/lorebook";
import { t } from "../i18n";
import { responseError } from "./requestError";

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}
export const listLorebooks = (): Promise<Lorebook[]> => fetch("/api/lorebooks").then((r) => json<Lorebook[]>(r));
export const getLorebook = (id: string): Promise<Lorebook> => fetch(`/api/lorebooks/${id}`).then((r) => json<Lorebook>(r));
export const createLorebook = (name: string): Promise<Lorebook> => fetch("/api/lorebooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, entries: {} }) }).then((r) => json<Lorebook>(r));
export const updateLorebook = (book: Lorebook): Promise<Lorebook> => fetch(`/api/lorebooks/${book.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(book) }).then((r) => json<Lorebook>(r));
export async function deleteLorebook(id: string): Promise<void> { const r = await fetch(`/api/lorebooks/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(t("lorebooks.error.delete")); }
export const duplicateLorebook = (id: string, name: string): Promise<Lorebook> =>
  fetch(`/api/lorebooks/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then((r) => json<Lorebook>(r));
export function importLorebook(file: File): Promise<Lorebook> { const form = new FormData(); form.append("file", file); return fetch("/api/lorebooks/import", { method: "POST", body: form }).then((r) => json<Lorebook>(r)); }
export const exportLorebookUrl = (id: string): string => `/api/lorebooks/${id}/export`;
export const getLorebookSettings = (): Promise<LorebookSettings> => fetch("/api/lorebooks/settings").then((r) => json<LorebookSettings>(r));
export const updateLorebookSettings = (patch: Partial<LorebookSettings>): Promise<LorebookSettings> => fetch("/api/lorebooks/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then((r) => json<LorebookSettings>(r));
export const scanLorebooks = (chat: Chat, maxContextTokens: number, trigger = "normal"): Promise<LorebookScanResult> => fetch("/api/lorebooks/scan-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat, maxContextTokens, trigger }) }).then((r) => json<LorebookScanResult>(r));
