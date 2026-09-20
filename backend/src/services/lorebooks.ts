import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CharacterCard, Chat, Persona } from "../types.js";
import { dataDir } from "./paths.js";

export type LorebookPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LorebookEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  vectorized: boolean;
  selective: boolean;
  selectiveLogic: 0 | 1 | 2 | 3;
  addMemo: boolean;
  order: number;
  position: LorebookPosition;
  disable: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
  delayUntilRecursion: number;
  probability: number;
  useProbability: boolean;
  depth: number;
  outletName: string;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  role: 0 | 1 | 2;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  characterFilter?: { isExclude?: boolean; names?: string[]; tags?: string[] };
  triggers: string[];
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  entries: Record<string, LorebookEntry>;
  extensions: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  source?: "native" | "sillytavern" | "character";
}

export interface LorebookSettings {
  enabled: boolean;
  globalLorebookIds: string[];
  scanDepth: number;
  minActivations: number;
  minActivationsDepthMax: number;
  budgetPercent: number;
  budgetCap: number;
  recursive: boolean;
  maxRecursionSteps: number;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  useGroupScoring: boolean;
  characterStrategy: 0 | 1 | 2;
  includeNames: boolean;
  scanNpcBank: boolean;
  scanVisualState: boolean;
}

export interface LorebookTraceEntry {
  lorebookId: string;
  lorebookName: string;
  uid: number;
  comment: string;
  status: "activated" | "disabled" | "filtered" | "no-match" | "probability" | "group" | "budget";
  reason: string;
  matchedKey?: string;
  tokenEstimate: number;
  source: "global" | "character" | "embedded" | "chat" | "persona";
}

export interface LorebookScanResult {
  before: string[];
  after: string[];
  authorNoteBefore: string[];
  authorNoteAfter: string[];
  exampleBefore: string[];
  exampleAfter: string[];
  atDepth: Array<{ content: string; depth: number; role: "system" | "user" | "assistant" }>;
  outlets: Record<string, string[]>;
  trace: LorebookTraceEntry[];
  usedTokens: number;
  budgetTokens: number;
  overflowed: boolean;
}

const DATA_DIR = dataDir();
const BOOKS_FILE = path.join(DATA_DIR, "lorebooks.json");
const SETTINGS_FILE = path.join(DATA_DIR, "lorebookSettings.json");
let queue: Promise<void> = Promise.resolve();

export const DEFAULT_SETTINGS: LorebookSettings = {
  enabled: true,
  globalLorebookIds: [],
  scanDepth: 2,
  minActivations: 0,
  minActivationsDepthMax: 0,
  budgetPercent: 25,
  budgetCap: 0,
  recursive: true,
  maxRecursionSteps: 0,
  caseSensitive: false,
  matchWholeWords: false,
  useGroupScoring: false,
  characterStrategy: 1,
  includeNames: false,
  scanNpcBank: false,
  scanVisualState: false,
};

export function newLorebookEntry(uid: number): LorebookEntry {
  return {
    uid, key: [], keysecondary: [], comment: "", content: "", constant: false, vectorized: false,
    selective: true, selectiveLogic: 0, addMemo: false, order: 100, position: 0, disable: false,
    ignoreBudget: false, excludeRecursion: false, preventRecursion: false, matchPersonaDescription: false,
    matchCharacterDescription: false, matchCharacterPersonality: false, matchCharacterDepthPrompt: false,
    matchScenario: false, matchCreatorNotes: false, delayUntilRecursion: 0, probability: 100,
    useProbability: true, depth: 4, outletName: "", group: "", groupOverride: false, groupWeight: 100,
    scanDepth: null, caseSensitive: null, matchWholeWords: null, useGroupScoring: null, automationId: "",
    role: 0, sticky: null, cooldown: null, delay: null, triggers: [], extensions: {},
  };
}

function normalizeEntry(raw: unknown, fallbackUid: number): LorebookEntry {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const entry = { ...newLorebookEntry(fallbackUid), ...value } as LorebookEntry;
  entry.uid = Number.isInteger(value.uid) ? Number(value.uid) : Number.isInteger(value.id) ? Number(value.id) : fallbackUid;
  const primaryKeys = value.key ?? value.keys;
  const secondaryKeys = value.keysecondary ?? value.secondary_keys;
  entry.key = Array.isArray(primaryKeys) ? primaryKeys.filter((x): x is string => typeof x === "string") : [];
  entry.keysecondary = Array.isArray(secondaryKeys) ? secondaryKeys.filter((x): x is string => typeof x === "string") : [];
  entry.comment = typeof value.comment === "string" ? value.comment : typeof value.name === "string" ? value.name : entry.comment;
  entry.disable = typeof value.enabled === "boolean" ? !value.enabled : entry.disable;
  entry.order = typeof value.insertion_order === "number" ? value.insertion_order : typeof value.priority === "number" ? value.priority : entry.order;
  entry.caseSensitive = typeof value.case_sensitive === "boolean" ? value.case_sensitive : entry.caseSensitive;
  entry.triggers = Array.isArray(value.triggers) ? value.triggers.filter((x): x is string => typeof x === "string") : [];
  return entry;
}

export function normalizeLorebook(raw: unknown, fallbackName = "Lorebook importado", source: Lorebook["source"] = "sillytavern"): Lorebook {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rawEntries = value.entries && typeof value.entries === "object" ? value.entries as Record<string, unknown> : {};
  const entries: Record<string, LorebookEntry> = {};
  let fallbackUid = 0;
  for (const [key, item] of Object.entries(rawEntries)) {
    const parsed = normalizeEntry(item, Number.isInteger(Number(key)) ? Number(key) : fallbackUid++);
    entries[String(parsed.uid)] = parsed;
  }
  const now = Date.now();
  return {
    id: typeof value.id === "string" ? value.id : randomUUID(),
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : fallbackName,
    description: typeof value.description === "string" ? value.description : "",
    entries,
    extensions: value.extensions && typeof value.extensions === "object" ? value.extensions as Record<string, unknown> : {},
    createdAt: typeof value.createdAt === "number" ? value.createdAt : now,
    updatedAt: now,
    source,
  };
}

async function atomicWrite(file: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, file);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

export async function listLorebooks(): Promise<Lorebook[]> { return readJson<Lorebook[]>(BOOKS_FILE, []); }
export async function getLorebook(id: string): Promise<Lorebook | null> { return (await listLorebooks()).find((b) => b.id === id) ?? null; }
export async function createLorebook(input: unknown, fallbackName?: string, source?: Lorebook["source"]): Promise<Lorebook> {
  return serialize(async () => { const books = await listLorebooks(); const book = normalizeLorebook(input, fallbackName, source); books.push(book); await atomicWrite(BOOKS_FILE, books); return book; });
}
export async function updateLorebook(id: string, input: unknown): Promise<Lorebook | null> {
  return serialize(async () => { const books = await listLorebooks(); const index = books.findIndex((b) => b.id === id); if (index < 0) return null; const incoming = normalizeLorebook(input, books[index].name, books[index].source); const updated = { ...incoming, id, createdAt: books[index].createdAt, updatedAt: Date.now() }; books[index] = updated; await atomicWrite(BOOKS_FILE, books); return updated; });
}
export async function deleteLorebook(id: string): Promise<boolean> {
  return serialize(async () => { const books = await listLorebooks(); const next = books.filter((b) => b.id !== id); if (next.length === books.length) return false; await atomicWrite(BOOKS_FILE, next); const settings = await getLorebookSettings(); if (settings.globalLorebookIds.includes(id)) await saveLorebookSettings({ ...settings, globalLorebookIds: settings.globalLorebookIds.filter((x) => x !== id) }); return true; });
}
export async function getLorebookSettings(): Promise<LorebookSettings> { return { ...DEFAULT_SETTINGS, ...(await readJson<Partial<LorebookSettings>>(SETTINGS_FILE, {})) }; }
export async function saveLorebookSettings(patch: Partial<LorebookSettings>): Promise<LorebookSettings> { const next = { ...(await getLorebookSettings()), ...patch }; await atomicWrite(SETTINGS_FILE, next); return next; }

function estimateTokens(text: string): number { return Math.max(1, Math.ceil(text.length / 4)); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function parseRegex(value: string): RegExp | null {
  const match = value.match(/^\/(.*)\/([dgimsuvy]*)$/);
  if (!match) return null;
  try { return new RegExp(match[1], match[2].replace("g", "")); } catch { return null; }
}
function keyMatches(text: string, key: string, caseSensitive: boolean, wholeWords: boolean): boolean {
  const explicit = parseRegex(key);
  if (explicit) return explicit.test(text);
  const flags = caseSensitive ? "u" : "iu";
  try { return new RegExp(wholeWords ? `(?:^|\\W)${escapeRegex(key)}(?:$|\\W)` : escapeRegex(key), flags).test(text); } catch { return false; }
}
function substitute(text: string, character: CharacterCard | null, persona: Persona | null, npcText: string, visualText: string): string {
  const dict: Record<string, string> = { char: character?.name ?? "", user: persona?.name ?? "", persona: persona?.description ?? "", scenario: character?.scenario ?? "", char_description: character?.description ?? "", npc_bank: npcText, active_npcs: npcText, visual_state: visualText };
  return text.replace(/{{\s*([^{}]+?)\s*}}/g, (raw, name: string) => dict[name.trim()] ?? raw);
}
function npcSnapshot(chat: Chat): string { return (chat.npcs ?? []).map((npc) => `[NPC]\nName: ${npc.name}\n${Object.entries(npc.values).map(([k, v]) => `${k}: ${v}`).join("\n")}\n[/NPC]`).join("\n"); }
function visualSnapshot(chat: Chat): string { return Object.entries(chat.visualState ?? {}).map(([name, state]) => `[VISUAL STATE]\nCharacter: ${name}\nOutfit: ${state.outfit}\nState: ${state.state.join(", ")}\n[/VISUAL STATE]`).join("\n"); }

interface ScanInput { chat: Chat; character: CharacterCard | null; persona: Persona | null; maxContextTokens: number; trigger?: string; }
interface SourcedEntry { entry: LorebookEntry; book: Lorebook; source: LorebookTraceEntry["source"]; }

export async function scanLorebooks(input: ScanInput, random: () => number = Math.random): Promise<LorebookScanResult> {
  const settings = await getLorebookSettings();
  const empty: LorebookScanResult = { before: [], after: [], authorNoteBefore: [], authorNoteAfter: [], exampleBefore: [], exampleAfter: [], atDepth: [], outlets: {}, trace: [], usedTokens: 0, budgetTokens: 0, overflowed: false };
  if (!settings.enabled) return empty;
  const books = await listLorebooks();
  const byId = new Map(books.map((book) => [book.id, book]));
  const sourced = new Map<string, SourcedEntry>();
  const add = (book: Lorebook | undefined, source: SourcedEntry["source"]) => { if (!book) return; for (const entry of Object.values(book.entries)) sourced.set(`${book.id}:${entry.uid}`, { entry: structuredClone(entry), book, source }); };
  const chatLorebookId = typeof input.chat.extensionData?.lorebookId === "string" ? input.chat.extensionData.lorebookId : null;
  if (chatLorebookId) add(byId.get(chatLorebookId), "chat");
  if (input.persona?.lorebookId) add(byId.get(input.persona.lorebookId), "persona");
  for (const id of input.character?.lorebookIds ?? []) add(byId.get(id), "character");
  if (input.character?.character_book) add(normalizeLorebook(input.character.character_book, `${input.character.name} · embebido`, "character"), "embedded");
  for (const id of settings.globalLorebookIds) add(byId.get(id), "global");

  const sourceRank = (source: SourcedEntry["source"]): number => source === "chat" ? 0 : source === "persona" ? 1 : source === "character" || source === "embedded" ? (settings.characterStrategy === 2 ? 3 : 2) : (settings.characterStrategy === 1 ? 3 : 2);
  const entries = [...sourced.values()].sort((a, b) => sourceRank(a.source) - sourceRank(b.source) || b.entry.order - a.entry.order);
  const npcText = settings.scanNpcBank ? npcSnapshot(input.chat) : "";
  const visualText = settings.scanVisualState ? visualSnapshot(input.chat) : "";
  const history = input.chat.messages.map((m) => `${settings.includeNames ? `${m.role}: ` : ""}${m.swipes[m.activeSwipeIndex] ?? ""}`).reverse();
  const budget = Math.max(1, Math.min(settings.budgetCap || Infinity, Math.round(input.maxContextTokens * settings.budgetPercent / 100)));
  empty.budgetTokens = budget;
  const activated = new Map<string, SourcedEntry>();
  const failedProbability = new Set<string>();
  let recursionText = "";
  let depth = settings.scanDepth;
  let loop = 0;

  while (true) {
    loop++;
    const candidates: Array<SourcedEntry & { matchedKey?: string }> = [];
    for (const item of entries) {
      const id = `${item.book.id}:${item.entry.uid}`;
      if (activated.has(id) || failedProbability.has(id)) continue;
      const e = item.entry;
      const baseTrace = { lorebookId: item.book.id, lorebookName: item.book.name, uid: e.uid, comment: e.comment, tokenEstimate: estimateTokens(e.content), source: item.source };
      if (e.disable) { if (loop === 1) empty.trace.push({ ...baseTrace, status: "disabled", reason: "Entry disabled" }); continue; }
      if (e.triggers.length && !e.triggers.includes(input.trigger ?? "normal")) { if (loop === 1) empty.trace.push({ ...baseTrace, status: "filtered", reason: "Generation type not allowed" }); continue; }
      if (e.characterFilter?.names?.length) { const found = e.characterFilter.names.includes(input.character?.name ?? ""); if (e.characterFilter.isExclude ? found : !found) { if (loop === 1) empty.trace.push({ ...baseTrace, status: "filtered", reason: "Character filter" }); continue; } }
      if (loop > 1 && (e.excludeRecursion || e.delayUntilRecursion > loop - 1)) continue;
      if (e.constant) { candidates.push(item); continue; }
      const scanDepth = Math.max(0, e.scanDepth ?? depth);
      const extras = [e.matchPersonaDescription ? input.persona?.description : "", e.matchCharacterDescription ? input.character?.description : "", e.matchCharacterPersonality ? input.character?.personality : "", e.matchScenario ? input.character?.scenario : "", e.matchCreatorNotes ? input.character?.creator_notes : "", npcText, visualText];
      const buffer = [...history.slice(0, scanDepth), recursionText, ...extras].filter(Boolean).join("\n");
      let matchedKey: string | undefined;
      for (const rawKey of e.key) { const key = substitute(rawKey, input.character, input.persona, npcText, visualText); if (key && keyMatches(buffer, key, e.caseSensitive ?? settings.caseSensitive, e.matchWholeWords ?? settings.matchWholeWords)) { matchedKey = rawKey; break; } }
      if (!matchedKey) { if (loop === 1) empty.trace.push({ ...baseTrace, status: "no-match", reason: "No primary keyword matched" }); continue; }
      if (e.selective && e.keysecondary.length) {
        const matches = e.keysecondary.map((raw) => keyMatches(buffer, substitute(raw, input.character, input.persona, npcText, visualText), e.caseSensitive ?? settings.caseSensitive, e.matchWholeWords ?? settings.matchWholeWords));
        const passes = e.selectiveLogic === 0 ? matches.some(Boolean) : e.selectiveLogic === 1 ? matches.every(Boolean) : e.selectiveLogic === 2 ? !matches.some(Boolean) : !matches.every(Boolean);
        if (!passes) { if (loop === 1) empty.trace.push({ ...baseTrace, status: "no-match", reason: "Secondary keywords did not satisfy the selected logic", matchedKey }); continue; }
      }
      candidates.push({ ...item, matchedKey });
    }

    const grouped = new Map<string, typeof candidates>();
    const selected: typeof candidates = [];
    for (const item of candidates) { if (!item.entry.group) selected.push(item); else grouped.set(item.entry.group, [...(grouped.get(item.entry.group) ?? []), item]); }
    for (const group of grouped.values()) {
      const override = group.filter((x) => x.entry.groupOverride);
      const pool = override.length ? override : group;
      if ((pool[0].entry.useGroupScoring ?? settings.useGroupScoring)) selected.push(pool.sort((a, b) => b.entry.groupWeight - a.entry.groupWeight)[0]);
      else { const total = pool.reduce((sum, x) => sum + Math.max(0, x.entry.groupWeight), 0); let roll = random() * Math.max(1, total); selected.push(pool.find((x) => (roll -= Math.max(0, x.entry.groupWeight)) <= 0) ?? pool[0]); }
    }

    let added = 0;
    for (const item of selected) {
      const e = item.entry; const id = `${item.book.id}:${e.uid}`;
      const baseTrace = { lorebookId: item.book.id, lorebookName: item.book.name, uid: e.uid, comment: e.comment, tokenEstimate: estimateTokens(e.content), source: item.source, matchedKey: item.matchedKey };
      if (e.useProbability && e.probability < 100 && random() * 100 > e.probability) { failedProbability.add(id); empty.trace.push({ ...baseTrace, status: "probability", reason: `Probability check failed (${e.probability}%)` }); continue; }
      const content = substitute(e.content, input.character, input.persona, npcText, visualText);
      const tokens = estimateTokens(content);
      if (!e.ignoreBudget && empty.usedTokens + tokens >= budget) { empty.overflowed = true; empty.trace.push({ ...baseTrace, status: "budget", reason: "Exceeded the available budget" }); continue; }
      e.content = content; activated.set(id, item); empty.usedTokens += tokens; added++;
      empty.trace.push({ ...baseTrace, status: "activated", reason: e.constant ? "Constant entry" : `Matched “${item.matchedKey ?? "keyword"}”` });
    }
    const recurse = selected.filter((x) => activated.has(`${x.book.id}:${x.entry.uid}`) && !x.entry.preventRecursion).map((x) => x.entry.content).join("\n");
    const needsMoreActivations = settings.minActivations > 0 && activated.size < settings.minActivations;
    const mayAdvanceDepth = needsMoreActivations && depth < history.length && (settings.minActivationsDepthMax <= 0 || depth < settings.minActivationsDepthMax);
    if (mayAdvanceDepth) {
      depth++;
      if (recurse) recursionText = `${recurse}\n${recursionText}`;
      continue;
    }
    if (!settings.recursive || !added || !recurse || empty.overflowed || (settings.maxRecursionSteps > 0 && loop >= settings.maxRecursionSteps)) break;
    recursionText = `${recurse}\n${recursionText}`;
  }

  for (const { entry } of activated.values()) {
    const content = entry.content.trim(); if (!content) continue;
    if (entry.position === 0) empty.before.push(content);
    else if (entry.position === 1) empty.after.push(content);
    else if (entry.position === 2) empty.authorNoteBefore.push(content);
    else if (entry.position === 3) empty.authorNoteAfter.push(content);
    else if (entry.position === 5) empty.exampleBefore.push(content);
    else if (entry.position === 6) empty.exampleAfter.push(content);
    else if (entry.position === 7) (empty.outlets[entry.outletName || "default"] ??= []).push(content);
    else empty.atDepth.push({ content, depth: Math.max(0, entry.depth), role: entry.role === 1 ? "user" : entry.role === 2 ? "assistant" : "system" });
  }
  return empty;
}
