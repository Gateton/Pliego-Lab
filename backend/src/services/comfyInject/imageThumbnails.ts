import { createThumbnailCache, type Thumbnail } from "../thumbnailCache.js";
import { dataPath } from "../paths.js";
import { IMAGES_DIR } from "./imageCache.js";

/**
 * Thumbnails for the pictures ComfyInject generated.
 *
 * A generated picture is ~1.3 MB and a chat can hold hundreds of them, so the gallery — which crops
 * them to squares anyway — asks here. The chat itself keeps the original: there the picture is the
 * illustration, and it is meant to be read at full size.
 */

const THUMBS_DIR = dataPath("thumbnails", "comfy-images");

/** Only UUID-named PNGs, the shape `cacheImage` writes, so a crafted name cannot walk out of the folder. */
const SAFE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;

const cache = createThumbnailCache({ sourceDir: IMAGES_DIR, cacheDir: THUMBS_DIR });

export function getGeneratedImageThumbnail(fileName: string, size: number): Promise<Thumbnail | null> {
  if (!SAFE_NAME.test(fileName)) return Promise.resolve(null);
  return cache.get(fileName, size);
}
