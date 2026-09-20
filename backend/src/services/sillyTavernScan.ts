import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { readCharaChunk } from "./pngCard.js";
import { normalizeCardJson } from "./characterCard.js";

export interface ScannedCharacter {
  file: string;
  name: string;
}

export interface ScannedPreset {
  file: string;
  name: string;
}

export interface ScannedPersona {
  avatarFile: string;
  name: string;
  description: string;
}

export interface ScannedLorebook {
  file: string;
  name: string;
  entryCount: number;
}

export interface ScanResult {
  characters: ScannedCharacter[];
  presets: ScannedPreset[];
  personas: ScannedPersona[];
  lorebooks: ScannedLorebook[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** Sub-folders of <root>/data that look like a real SillyTavern user profile. */
export async function listUsers(root: string): Promise<string[]> {
  const dataDir = path.join(root, "data");
  if (!(await isDir(dataDir))) return [];
  const entries = await readdir(dataDir, { withFileTypes: true });
  const users: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // `settings.json` is the one file every real ST user profile has — some internal cache
    // folders (e.g. a tokenizer cache) happen to also have their own "characters" dir, so
    // that alone isn't a reliable signal.
    if (await exists(path.join(dataDir, entry.name, "settings.json"))) {
      users.push(entry.name);
    }
  }
  return users;
}

async function scanCharacters(userDir: string): Promise<ScannedCharacter[]> {
  const charactersDir = path.join(userDir, "characters");
  if (!(await isDir(charactersDir))) return [];
  const files = (await readdir(charactersDir)).filter((f) => f.toLowerCase().endsWith(".png"));
  const results: ScannedCharacter[] = [];
  for (const file of files) {
    let name = path.basename(file, ".png");
    try {
      const buffer = await readFile(path.join(charactersDir, file));
      const json = readCharaChunk(buffer);
      const fields = normalizeCardJson(JSON.parse(json));
      if (fields.name) name = fields.name;
    } catch {
      // Not a readable character card (corrupt PNG, no chara chunk) — still list it by
      // filename so the user can see it exists; the real error surfaces at import time.
    }
    results.push({ file, name });
  }
  return results;
}

async function scanPresets(userDir: string): Promise<ScannedPreset[]> {
  const presetsDir = path.join(userDir, "OpenAI Settings");
  if (!(await isDir(presetsDir))) return [];
  const files = (await readdir(presetsDir)).filter((f) => f.toLowerCase().endsWith(".json"));
  return files.map((file) => ({ file, name: path.basename(file, ".json") }));
}

async function scanLorebooks(userDir: string): Promise<ScannedLorebook[]> {
  const worldsDir = path.join(userDir, "worlds");
  if (!(await isDir(worldsDir))) return [];
  const files = (await readdir(worldsDir)).filter((f) => f.toLowerCase().endsWith(".json"));
  const results: ScannedLorebook[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(path.join(worldsDir, file), "utf8"));
      const entries = raw?.entries && typeof raw.entries === "object" ? Object.keys(raw.entries).length : 0;
      results.push({ file, name: typeof raw?.name === "string" ? raw.name : path.basename(file, ".json"), entryCount: entries });
    } catch {
      results.push({ file, name: path.basename(file, ".json"), entryCount: 0 });
    }
  }
  return results;
}

async function scanPersonas(userDir: string): Promise<ScannedPersona[]> {
  const settingsPath = path.join(userDir, "settings.json");
  if (!(await exists(settingsPath))) return [];
  try {
    const raw = JSON.parse(await readFile(settingsPath, "utf-8"));
    const personas = (raw.power_user?.personas ?? {}) as Record<string, string>;
    const descriptions = (raw.power_user?.persona_descriptions ?? {}) as Record<string, { description?: string }>;
    return Object.entries(personas).map(([avatarFile, name]) => ({
      avatarFile,
      name,
      description: descriptions[avatarFile]?.description ?? "",
    }));
  } catch {
    return [];
  }
}

export async function scan(root: string, user: string): Promise<ScanResult> {
  const userDir = path.join(root, "data", user);
  const [characters, presets, personas, lorebooks] = await Promise.all([
    scanCharacters(userDir),
    scanPresets(userDir),
    scanPersonas(userDir),
    scanLorebooks(userDir),
  ]);
  return { characters, presets, personas, lorebooks };
}
