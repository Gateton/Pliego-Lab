import path from "node:path";
import { createThumbnailCache, type Thumbnail } from "./thumbnailCache.js";

/**
 * Thumbnails for the character library.
 *
 * A card is stored as the original art the user imported, and the interface paints it as a 24-100 px
 * avatar in the library grid, the chat list and the message bubbles. Every one of those slots asks
 * here instead of pulling the whole card (see `thumbnailCache.ts` for the shared machinery).
 */

export const CHARACTERS_DIR = path.resolve(process.cwd(), "data", "characters");
const THUMBS_DIR = path.resolve(process.cwd(), "data", "thumbnails", "characters");

export type CharacterThumbnail = Thumbnail;

const cache = createThumbnailCache({ sourceDir: CHARACTERS_DIR, cacheDir: THUMBS_DIR });

export function getCharacterThumbnail(id: string, size: number): Promise<Thumbnail | null> {
  return cache.get(`${id}.png`, size);
}

/** Drops every cached size for a character. Called when the card is deleted. */
export function removeCharacterThumbnails(id: string): Promise<void> {
  return cache.remove(`${id}.png`);
}
