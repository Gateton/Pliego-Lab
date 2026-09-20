import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ComfyClientError } from "./comfyClient.js";

export const IMAGES_DIR = path.resolve(process.cwd(), "data", "comfy-images");
const dirReady = mkdir(IMAGES_DIR, { recursive: true });

/** Downloads a ComfyUI-hosted image and caches it locally so it survives ComfyUI clearing its own output folder. */
export async function cacheImage(comfyImageUrl: string): Promise<string> {
  await dirReady;

  let response: Response;
  try {
    response = await fetch(comfyImageUrl);
  } catch (error) {
    throw new ComfyClientError(`Could not download generated image: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new ComfyClientError(`Failed to download generated image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `${randomUUID()}.png`;
  await writeFile(path.join(IMAGES_DIR, filename), buffer);

  return `/api/comfyinject/images/${filename}`;
}
