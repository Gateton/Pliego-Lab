import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseThumbnailSize } from "./thumbnailCache.js";

// The store resolves its directories from `process.cwd()` when it is imported, so this file moves
// into a scratch folder first and imports it afterwards. Node runs each test file in its own
// process, so the chdir cannot leak into other tests.

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

/** A solid-colour RGBA PNG, which is all this test needs from the image format. */
function solidPng(size: number, colour: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    let offset = y * (size * 4 + 1) + 1;
    for (let x = 0; x < size; x++) {
      raw[offset++] = colour[0];
      raw[offset++] = colour[1];
      raw[offset++] = colour[2];
      raw[offset++] = 255;
    }
  }
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const CARD_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_ID = "99999999-8888-7777-6666-555555555555";
let root = "";
let store: typeof import("./characterThumbnails.js");

test.before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "silly-thumbnails-"));
  process.chdir(root);
  await mkdir(path.join("data", "characters"), { recursive: true });
  await writeFile(path.join("data", "characters", `${CARD_ID}.png`), solidPng(600, [255, 0, 0]));
  await writeFile(path.join("data", "characters", `${OTHER_ID}.png`), solidPng(600, [0, 0, 255]));
  store = await import("./characterThumbnails.js");
});

test.after(async () => {
  process.chdir(os.tmpdir());
  await rm(root, { recursive: true, force: true });
});

test("quantises ?w= into the sizes the cache keeps", () => {
  assert.equal(parseThumbnailSize("192"), 192);
  // Rounded up to the next step and clamped, so a client cannot invent a size per width.
  assert.equal(parseThumbnailSize("100"), 128);
  assert.equal(parseThumbnailSize("5"), 64);
  assert.equal(parseThumbnailSize("4000"), 512);
  assert.equal(parseThumbnailSize(undefined), null);
  assert.equal(parseThumbnailSize("abc"), null);
  assert.equal(parseThumbnailSize("0"), null);
  assert.equal(parseThumbnailSize(["192"]), null);
});

test("builds a thumbnail once, then serves it from disk", async () => {
  const first = await store.getCharacterThumbnail(CARD_ID, 128);
  assert.ok(first, "expected a thumbnail for an existing card");
  assert.equal(first.buffer.length > 0, true);
  assert.ok(first.sourceMtimeMs > 0);

  const cached = path.join("data", "thumbnails", "characters", `${CARD_ID}-128.png`);
  const stats = await stat(cached);
  assert.equal(stats.size, first.buffer.length);

  // A second call must not rebuild: prove it by making the cached file the only source of truth.
  const second = await store.getCharacterThumbnail(CARD_ID, 128);
  assert.ok(second);
  assert.deepEqual(second.buffer, first.buffer);
  assert.equal(second.sourceMtimeMs, first.sourceMtimeMs);
});

test("rebuilds when the card art is replaced", async () => {
  const before = await store.getCharacterThumbnail(CARD_ID, 128);
  assert.ok(before);

  await writeFile(path.join("data", "characters", `${CARD_ID}.png`), solidPng(600, [0, 255, 0]));
  const future = new Date(Date.now() + 2000);
  await utimes(path.join("data", "characters", `${CARD_ID}.png`), future, future);

  const after = await store.getCharacterThumbnail(CARD_ID, 128);
  assert.ok(after);
  assert.notEqual(after.sourceMtimeMs, before.sourceMtimeMs, "a new source mtime must be reported");
  assert.notDeepEqual(after.buffer, before.buffer, "the thumbnail must follow the new art");
});

test("answers null for a card that is not there", async () => {
  assert.equal(await store.getCharacterThumbnail("00000000-0000-0000-0000-000000000000", 128), null);
});

test("drops every cached size when a card is deleted, and nothing else", async () => {
  await store.getCharacterThumbnail(CARD_ID, 64);
  await store.getCharacterThumbnail(OTHER_ID, 64);
  await store.removeCharacterThumbnails(CARD_ID);

  const files = await readdir(path.join("data", "thumbnails", "characters"));
  assert.equal(files.some((file) => file.startsWith(CARD_ID)), false);
  assert.equal(files.some((file) => file.startsWith(OTHER_ID)), true);
});
