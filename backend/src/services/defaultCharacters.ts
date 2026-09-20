import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import * as characterStore from "./characterStore.js";
import { normalizeCardJson } from "./characterCard.js";
import { readCharaChunk } from "./pngCard.js";

const DEFAULT_CHARACTERS_DIR = path.resolve(process.cwd(), "assets", "default-characters");

export async function seedDefaultCharacters(): Promise<void> {
  let files: string[];
  try {
    files = (await readdir(DEFAULT_CHARACTERS_DIR)).filter((file) => file.endsWith(".png")).sort();
  } catch {
    return;
  }

  const existing = new Set((await characterStore.listCharacters()).map((character) => character.name));
  for (const file of files) {
    const image = await readFile(path.join(DEFAULT_CHARACTERS_DIR, file));
    const fields = normalizeCardJson(JSON.parse(readCharaChunk(image)));
    if (!fields.name || existing.has(fields.name)) continue;
    await characterStore.createCharacter(fields, image);
    existing.add(fields.name);
  }
}
