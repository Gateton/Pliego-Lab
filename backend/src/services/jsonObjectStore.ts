import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataPath } from "./paths.js";

/** Generic get/update over a single JSON object file (app-wide settings), with atomic writes
 * serialized through a queue. Mirrors createJsonArrayStore's pattern for list-shaped stores. */
export function createJsonObjectStore<T>(fileName: string, defaults: T) {
  const filePath = dataPath(fileName);
  const dirReady = mkdir(path.dirname(filePath), { recursive: true });
  let writeQueue: Promise<void> = Promise.resolve();

  /** Raw parsed JSON with no merge against defaults — null if the file doesn't exist yet. Only
   * needed by callers with stricter-than-spread merge rules (e.g. re-seeding an array field that
   * exists but is empty, not just absent). */
  async function readRaw(): Promise<Partial<T> | null> {
    await dirReady;
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as Partial<T>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async function get(): Promise<T> {
    const parsed = await readRaw();
    return parsed ? { ...defaults, ...parsed } : defaults;
  }

  function update(settings: T): Promise<T> {
    const result = writeQueue.then(async () => {
      const tmpPath = `${filePath}.tmp`;
      await writeFile(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
      await rename(tmpPath, filePath);
      return settings;
    });
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return { get, update, readRaw };
}
