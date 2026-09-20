import { Worker } from "node:worker_threads";
import { makeThumbnailPng } from "./pngThumbnail.js";

/**
 * Two workers that turn card PNGs into thumbnails, off the server's thread.
 *
 * Building the thumbnail for a 4096x4096 card costs a few hundred milliseconds of straight CPU. The
 * library grid asks for a dozen of those at once the first time it is scrolled, so doing the work
 * inline would freeze the event loop in bursts — chat streaming included. The workers are started
 * lazily and kept around, and if they cannot be started at all the work falls back to this thread
 * (slow, but thumbnails keep working).
 */

const MAX_WORKERS = 2;
const WORKER_URL = new URL("./thumbnailWorker.js", import.meta.url);

interface PendingJob {
  id: number;
  buffer: Buffer;
  size: number;
  resolve: (thumbnail: Buffer | null) => void;
}

interface Slot {
  worker: Worker;
  job: PendingJob | null;
}

const slots: Slot[] = [];
const queue: PendingJob[] = [];
let nextId = 1;

export function runThumbnailJob(buffer: Buffer, size: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    queue.push({ id: nextId++, buffer, size, resolve });
    pump();
  });
}

/** Hands queued jobs to free workers, starting one when there is room. */
function pump(): void {
  while (queue.length > 0) {
    let slot = slots.find((entry) => entry.job === null) ?? null;

    if (!slot) {
      if (slots.length >= MAX_WORKERS) return; // Everything is busy; completions pump again.
      slot = startWorker();
      if (!slot) {
        // No worker threads available: fall back to blocking this thread, one job at a time.
        const job = queue.shift() as PendingJob;
        job.resolve(makeThumbnailPng(job.buffer, job.size)?.buffer ?? null);
        continue;
      }
    }

    const job = queue.shift() as PendingJob;
    slot.job = job;
    slot.worker.postMessage({ id: job.id, buffer: job.buffer, size: job.size });
  }
}

function startWorker(): Slot | null {
  let worker: Worker;
  try {
    worker = new Worker(WORKER_URL);
    worker.unref();
  } catch (error) {
    console.error("Could not start a thumbnail worker:", error);
    return null;
  }

  const slot: Slot = { worker, job: null };
  slots.push(slot);

  worker.on("message", (message: { id: number; buffer: Uint8Array | null }) => {
    const job = slot.job;
    slot.job = null;
    if (job && job.id === message.id) {
      job.resolve(message.buffer ? Buffer.from(message.buffer.buffer, message.buffer.byteOffset, message.buffer.byteLength) : null);
    }
    pump();
  });

  const stop = (reason: string) => {
    const index = slots.indexOf(slot);
    if (index === -1) return;
    slots.splice(index, 1);
    console.error(`Thumbnail worker ${reason}.`);
    // The job it was holding is retried on this thread instead of being dropped.
    const job = slot.job;
    slot.job = null;
    if (job) job.resolve(makeThumbnailPng(job.buffer, job.size)?.buffer ?? null);
    pump();
  };

  worker.on("error", (error) => {
    console.error("Thumbnail worker failed:", error);
    stop("failed");
  });
  worker.on("exit", (code) => {
    if (code !== 0) stop(`exited with code ${code}`);
  });

  return slot;
}
