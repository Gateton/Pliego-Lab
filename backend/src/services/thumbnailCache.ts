import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { runThumbnailJob } from "./thumbnailPool.js";

/**
 * Disk cache for downscaled PNGs.
 *
 * The app stores full-size art and then paints it in avatar-sized slots: character cards in the
 * library grid, generated pictures in the chat gallery. Sending the original to fill a 100 px square
 * is what made the interface crawl (see `pngThumbnail.ts`), so every small slot is answered from a
 * cache like this one: built once per file and size, then read back from disk.
 *
 * The source is assumed to be immutable per name (character cards are addressed by id, generated
 * images by UUID); when the file is rewritten, its mtime invalidates the cached size.
 */

const MIN_SIZE = 64;
const MAX_SIZE = 512;
const SIZE_STEP = 32;

export interface Thumbnail {
  buffer: Buffer;
  /** mtime of the source PNG the thumbnail was built from, for cache-busting URLs. */
  sourceMtimeMs: number;
}

/**
 * Normalises a `?w=` value into one of the sizes this cache keeps. Requests are quantised up to a
 * 32 px step and clamped, so a client cannot fill the disk with one file per width it invents.
 * Anything non-numeric means "no thumbnail": the caller serves the original.
 */
export function parseThumbnailSize(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d{1,4}$/.test(raw)) return null;
  const requested = Number(raw);
  if (requested < 1) return null;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.ceil(requested / SIZE_STEP) * SIZE_STEP));
}

export interface ThumbnailCache {
  get(fileName: string, size: number): Promise<Thumbnail | null>;
  /** Drops every cached size of one source file. Called when the source is deleted. */
  remove(fileName: string): Promise<void>;
}

function stem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function createThumbnailCache(options: { sourceDir: string; cacheDir: string }): ThumbnailCache {
  const { sourceDir, cacheDir } = options;

  // Two React renders (or a strict-mode double mount) asking for the same tile must not decode the
  // same source twice, so concurrent builders share one promise.
  const inFlight = new Map<string, Promise<Thumbnail | null>>();

  async function build(
    sourcePath: string,
    cachePath: string,
    size: number,
    sourceMtimeMs: number,
  ): Promise<Thumbnail | null> {
    try {
      const thumbnail = await runThumbnailJob(await readFile(sourcePath), size);
      if (!thumbnail) return null;

      await mkdir(cacheDir, { recursive: true });
      const temporary = `${cachePath}.tmp`;
      await writeFile(temporary, thumbnail);
      await rename(temporary, cachePath);
      return { buffer: thumbnail, sourceMtimeMs };
    } catch (error) {
      console.error(`Could not build the thumbnail for ${path.basename(sourcePath)}:`, error);
      return null;
    }
  }

  return {
    async get(fileName: string, size: number): Promise<Thumbnail | null> {
      const sourcePath = path.join(sourceDir, fileName);

      let source;
      try {
        source = await stat(sourcePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
      if (!source.isFile()) return null;

      const cachePath = path.join(cacheDir, `${stem(fileName)}-${size}.png`);
      try {
        const cached = await stat(cachePath);
        if (cached.size > 0 && cached.mtimeMs >= source.mtimeMs) {
          return { buffer: await readFile(cachePath), sourceMtimeMs: source.mtimeMs };
        }
      } catch {
        // Not cached yet (or the cache file vanished): fall through and build it.
      }

      const key = `${fileName}:${size}:${source.mtimeMs}`;
      const running = inFlight.get(key);
      if (running) return running;

      const job = build(sourcePath, cachePath, size, source.mtimeMs).finally(() => inFlight.delete(key));
      inFlight.set(key, job);
      return job;
    },

    async remove(fileName: string): Promise<void> {
      try {
        const files = await readdir(cacheDir);
        const prefix = `${stem(fileName)}-`;
        const stale = files.filter((file) => file.startsWith(prefix) && file.endsWith(".png"));
        await Promise.all(stale.map((file) => rm(path.join(cacheDir, file), { force: true })));
      } catch {
        // No cache directory yet: there is nothing to clean up.
      }
    },
  };
}
