import extract from "png-chunks-extract";
import encode from "png-chunks-encode";
import { decode as decodeText, encode as encodeText } from "png-chunk-text";

export class PngCardError extends Error {}

/** Reads the embedded character JSON string from a PNG's tEXt chunks (ccv3 takes priority over chara). */
export function readCharaChunk(buffer: Buffer): string {
  let chunks: ReturnType<typeof extract>;
  try {
    chunks = extract(new Uint8Array(buffer));
  } catch {
    throw new PngCardError("Invalid PNG file");
  }

  const texts = chunks.filter((c) => c.name === "tEXt").map((c) => decodeText(c.data));

  const ccv3 = texts.find((t) => t.keyword.toLowerCase() === "ccv3");
  if (ccv3) return Buffer.from(ccv3.text, "base64").toString("utf8");

  const chara = texts.find((t) => t.keyword.toLowerCase() === "chara");
  if (chara) return Buffer.from(chara.text, "base64").toString("utf8");

  throw new PngCardError("No character metadata found in this PNG");
}

/** Returns a new PNG buffer with any existing chara/ccv3 tEXt chunks replaced by a fresh chara chunk. */
export function writeCharaChunk(buffer: Buffer, jsonString: string): Buffer {
  let chunks: ReturnType<typeof extract>;
  try {
    chunks = extract(new Uint8Array(buffer));
  } catch {
    throw new PngCardError("Invalid PNG file");
  }

  for (const chunk of chunks.filter((c) => c.name === "tEXt")) {
    const decoded = decodeText(chunk.data);
    if (decoded.keyword.toLowerCase() === "chara" || decoded.keyword.toLowerCase() === "ccv3") {
      chunks.splice(chunks.indexOf(chunk), 1);
    }
  }

  const base64 = Buffer.from(jsonString, "utf8").toString("base64");
  // Insert right before the last chunk, which is IEND in a valid PNG.
  chunks.splice(-1, 0, encodeText("chara", base64));

  return Buffer.from(encode(chunks));
}
