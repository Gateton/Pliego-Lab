import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CharacterCard, CharacterSummary } from "../types.js";
import { normalizeCardJson, toCardV2Json, type CharacterFields } from "./characterCard.js";
import { readCharaChunk, writeCharaChunk } from "./pngCard.js";
import { dataPath } from "./paths.js";

const DATA_DIR = dataPath("characters");
const PLACEHOLDER_PATH = path.resolve(process.cwd(), "assets", "placeholder-character.png");
const SYSTEM_CHARACTER_NAMES = new Set(["pliego lab guide"]);

function isSystemCharacter(name: string): boolean {
  return SYSTEM_CHARACTER_NAMES.has(name.trim().toLocaleLowerCase());
}
/**
 * Re-created on every use: the folder can disappear while the process is running (someone cleaning
 * the data directory by hand). A one-shot mkdir promise resolved at import time left every later
 * readdir throwing ENOENT, which took the whole server down because the route has no try/catch.
 */
function ensureDataDir(): Promise<string | undefined> {
  return mkdir(DATA_DIR, { recursive: true });
}

function pngPath(id: string): string {
  return path.join(DATA_DIR, `${id}.png`);
}

async function atomicWrite(filePath: string, buffer: Buffer): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, buffer);
  await rename(tmpPath, filePath);
}

async function readCardFromFile(id: string): Promise<{ card: CharacterCard; image: Buffer } | null> {
  await ensureDataDir();
  let image: Buffer;
  try {
    image = await readFile(pngPath(id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const json = readCharaChunk(image);
  const fields = normalizeCardJson(JSON.parse(json));
  return { card: { id, ...fields }, image };
}

export async function listCharacters(): Promise<CharacterSummary[]> {
  await ensureDataDir();
  const files = await readCardFiles();
  const signature = files.map((file) => `${file.file}:${file.size}:${file.mtimeMs}`).join("|");

  if (listCache?.signature === signature) return listCache.summaries;
  const running = listings.get(signature);
  if (running) return running;

  const job = buildListing(signature, files).finally(() => listings.delete(signature));
  listings.set(signature, job);
  return job;
}

interface CardFile {
  id: string;
  file: string;
  size: number;
  mtimeMs: number;
  addedAt: number;
}

/**
 * Names live inside the PNG (`chara` chunk), so listing the library means reading every card: with
 * a couple hundred cards that is ~460 MB, measured at 1.8 s. The interface asks for this list from
 * several places at once (App, the right panel, the first-run wizard), so the result is kept until
 * the files change. A signature of name+size+mtime is enough to notice a rename, an edit, a delete
 * or a file copied into the folder by hand.
 */
let listCache: { signature: string; summaries: CharacterSummary[] } | null = null;
const listings = new Map<string, Promise<CharacterSummary[]>>();

async function readCardFiles(): Promise<CardFile[]> {
  await ensureDataDir();
  const names = (await readdir(DATA_DIR)).filter((f) => f.endsWith(".png")).sort();
  const files = await Promise.all(
    names.map(async (file): Promise<CardFile | null> => {
      try {
        const stats = await stat(path.join(DATA_DIR, file));
        return {
          id: file.replace(/\.png$/, ""),
          file,
          size: stats.size,
          mtimeMs: stats.mtimeMs,
          addedAt: stats.birthtimeMs || stats.mtimeMs,
        };
      } catch {
        // The file was deleted while the folder was being walked.
        return null;
      }
    }),
  );
  return files.filter((file): file is CardFile => file !== null);
}

async function buildListing(signature: string, files: CardFile[]): Promise<CharacterSummary[]> {
  const summaries: CharacterSummary[] = [];
  let complete = true;

  for (const file of files) {
    try {
      const result = await readCardFromFile(file.id);
      if (result) {
        summaries.push({
          id: file.id,
          name: result.card.name,
          tags: result.card.tags,
          addedAt: file.addedAt,
          mtimeMs: file.mtimeMs,
          isWorld: result.card.isWorld === true,
          isSystem: isSystemCharacter(result.card.name),
        });
      }
    } catch (error) {
      // A card that fails to read (corrupt chunk, I/O hiccup) is left out of this listing, and the
      // listing is not cached: the next call retries instead of hiding the card until a restart.
      console.error(`Skipping unreadable character file ${file.file}:`, error);
      complete = false;
    }
  }

  if (complete) listCache = { signature, summaries };
  return summaries;
}

export async function createCharacter(
  fields: Partial<CharacterFields> & { name: string },
  imageBuffer?: Buffer,
): Promise<CharacterCard> {
  const id = randomUUID();
  const card: CharacterCard = {
    id,
    name: fields.name,
    description: fields.description ?? "",
    personality: fields.personality ?? "",
    scenario: fields.scenario ?? "",
    first_mes: fields.first_mes ?? "",
    mes_example: fields.mes_example ?? "",
    creator_notes: fields.creator_notes ?? "",
    system_prompt: fields.system_prompt ?? "",
    post_history_instructions: fields.post_history_instructions ?? "",
    tags: fields.tags ?? [],
    imageTags: fields.imageTags ?? "",
    creator: fields.creator ?? "",
    character_version: fields.character_version ?? "",
    character_book: fields.character_book,
    lorebookIds: fields.lorebookIds ?? [],
    isWorld: fields.isWorld ?? false,
  };

  const baseImage = imageBuffer ?? (await readFile(PLACEHOLDER_PATH));
  const png = writeCharaChunk(baseImage, toCardV2Json(card));
  await ensureDataDir();
  await atomicWrite(pngPath(id), png);
  return card;
}

export async function readCharacter(id: string): Promise<CharacterCard | null> {
  const result = await readCardFromFile(id);
  return result?.card ?? null;
}

export async function updateCharacterFields(
  id: string,
  fields: Partial<CharacterFields>,
): Promise<CharacterCard | null> {
  const existing = await readCardFromFile(id);
  if (!existing) return null;

  const card: CharacterCard = { ...existing.card, ...fields, id };
  const png = writeCharaChunk(existing.image, toCardV2Json(card));
  await atomicWrite(pngPath(id), png);
  return card;
}

export async function replaceCharacterImage(id: string, imageBuffer: Buffer): Promise<CharacterCard | null> {
  const existing = await readCardFromFile(id);
  if (!existing) return null;

  const png = writeCharaChunk(imageBuffer, toCardV2Json(existing.card));
  await atomicWrite(pngPath(id), png);
  return existing.card;
}

export async function deleteCharacter(id: string): Promise<boolean> {
  await ensureDataDir();
  try {
    await rm(pngPath(id));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function getCharacterImageBuffer(id: string): Promise<Buffer | null> {
  const existing = await readCardFromFile(id);
  return existing?.image ?? null;
}

export async function getCharacterPngPath(id: string): Promise<string | null> {
  await ensureDataDir();
  try {
    await access(pngPath(id));
    return pngPath(id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
