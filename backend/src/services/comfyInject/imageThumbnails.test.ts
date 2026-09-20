import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Same scratch-folder trick as the character thumbnail test: the cache resolves its directories from
// `process.cwd()` when the module is imported.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function solidPng(size: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    let offset = y * (size * 4 + 1) + 1;
    for (let x = 0; x < size; x++) {
      raw[offset++] = 200;
      raw[offset++] = 120;
      raw[offset++] = 40;
      raw[offset++] = 255;
    }
  }
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const IMAGE_NAME = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png";
let root = "";
let store: typeof import("./imageThumbnails.js");

test.before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "silly-comfy-thumbs-"));
  process.chdir(root);
  await mkdir(path.join("data", "comfy-images"), { recursive: true });
  await writeFile(path.join("data", "comfy-images", IMAGE_NAME), solidPng(400));
  store = await import("./imageThumbnails.js");
});

test.after(async () => {
  process.chdir(os.tmpdir());
  await rm(root, { recursive: true, force: true });
});

test("downscales a generated picture for the gallery", async () => {
  const thumbnail = await store.getGeneratedImageThumbnail(IMAGE_NAME, 192);
  assert.ok(thumbnail, "expected a thumbnail for an existing generated image");
  assert.ok(thumbnail.buffer.length < 400 * 400 * 4, "expected a much smaller file");
});

test("refuses names that are not the UUID shape it writes", async () => {
  // Anything else has to fall through to the static handler rather than be resolved against the
  // images folder, which is what keeps a crafted name from walking out of it.
  for (const name of ["../../settings.json", "..%2Fsettings.json", "notes.txt", "image.png", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png.exe"]) {
    assert.equal(await store.getGeneratedImageThumbnail(name, 192), null, `expected null for ${name}`);
  }
});
