import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UsageEvent } from "../types.js";
import { dataPath } from "./paths.js";

const FILE_PATH = dataPath("usage.json");
const dirReady = mkdir(path.dirname(FILE_PATH), { recursive: true });

let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<UsageEvent[]> {
  await dirReady;
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw) as UsageEvent[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function getUsageEvents(): Promise<UsageEvent[]> {
  return readAll();
}

export async function recordUsage(event: Omit<UsageEvent, "id">): Promise<void> {
  // Skip events with nothing measurable — providers that report no usage at all would otherwise
  // fill the log with empty rows.
  const values = [event.inputTokens, event.outputTokens, event.totalTokens, event.costUsd, event.promptTokens, event.completionTokens];
  if (!values.some((v) => typeof v === "number" && v !== 0)) return;
  // Chain the whole read-modify-write onto the queue, not just the write — two concurrent
  // recordUsage calls must never both read the same base array and lose one one's append.
  const result = writeQueue.then(async () => {
    const events = await readAll();
    events.push({ ...event, id: randomUUID() });
    const tmpPath = `${FILE_PATH}.tmp`;
    await writeFile(tmpPath, JSON.stringify(events, null, 2), "utf-8");
    await rename(tmpPath, FILE_PATH);
  });
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
