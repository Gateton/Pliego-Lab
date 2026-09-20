import { parentPort } from "node:worker_threads";
import { makeThumbnailPng } from "./pngThumbnail.js";

/**
 * Worker side of the thumbnail pool (`thumbnailPool.ts`).
 *
 * Decoding a 4096x4096 card takes a few hundred milliseconds, and doing that on the server's thread
 * would stall every other request — including an in-flight chat stream — so the work happens here.
 */

interface Job {
  id: number;
  buffer: Uint8Array;
  size: number;
}

parentPort?.on("message", (job: Job) => {
  const source = Buffer.from(job.buffer.buffer, job.buffer.byteOffset, job.buffer.byteLength);
  const thumbnail = makeThumbnailPng(source, job.size);
  parentPort?.postMessage({ id: job.id, buffer: thumbnail?.buffer ?? null });
});
