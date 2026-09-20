import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NpcRecord } from "../types.js";

const FILE_PATH = path.resolve(process.cwd(), "data", "favoriteNpcs.json");
const dirReady = mkdir(path.dirname(FILE_PATH), { recursive: true });

let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<NpcRecord[]> {
  await dirReady;
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw) as NpcRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(npcs: NpcRecord[]): Promise<void> {
  const tmpPath = `${FILE_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(npcs, null, 2), "utf-8");
  await rename(tmpPath, FILE_PATH);
}

export async function getFavoriteNpcs(): Promise<NpcRecord[]> {
  return readAll();
}

// Snapshots the given NPC into the global favorites store — a copy, not a reference, so
// editing it later in either the source chat or the favorites list never touches the other.
export async function addFavoriteNpc(npc: Omit<NpcRecord, "id">): Promise<NpcRecord> {
  const result = writeQueue.then(async () => {
    const npcs = await readAll();
    const favorite: NpcRecord = { ...npc, id: randomUUID(), values: { ...npc.values } };
    npcs.push(favorite);
    await writeAll(npcs);
    return favorite;
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function removeFavoriteNpc(id: string): Promise<boolean> {
  const result = writeQueue.then(async () => {
    const npcs = await readAll();
    const next = npcs.filter((n) => n.id !== id);
    if (next.length === npcs.length) return false;
    await writeAll(next);
    return true;
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
