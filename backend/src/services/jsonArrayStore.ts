import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Generic CRUD over a single JSON array file, with atomic writes serialized through a queue. */
export function createJsonArrayStore<T extends { id: string }>(fileName: string) {
  const filePath = path.resolve(process.cwd(), "data", fileName);
  const dirReady = mkdir(path.dirname(filePath), { recursive: true });
  let writeQueue: Promise<void> = Promise.resolve();

  async function readAll(): Promise<T[]> {
    await dirReady;
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeAll(items: T[]): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(items, null, 2), "utf-8");
    await rename(tmpPath, filePath);
  }

  function enqueue<R>(fn: () => Promise<R>): Promise<R> {
    const result = writeQueue.then(fn);
    writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    list: (): Promise<T[]> => readAll(),

    create: (item: T): Promise<T> =>
      enqueue(async () => {
        const items = await readAll();
        items.push(item);
        await writeAll(items);
        return item;
      }),

    update: (id: string, patch: Partial<T>): Promise<T | null> =>
      enqueue(async () => {
        const items = await readAll();
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return null;
        const updated = { ...items[idx], ...patch, id };
        items[idx] = updated;
        await writeAll(items);
        return updated;
      }),

    remove: (id: string): Promise<boolean> =>
      enqueue(async () => {
        const items = await readAll();
        const idx = items.findIndex((i) => i.id === id);
        if (idx === -1) return false;
        items.splice(idx, 1);
        await writeAll(items);
        return true;
      }),
  };
}
