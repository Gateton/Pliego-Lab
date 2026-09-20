import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeCharaChunk } from "./pngCard.js";

// `characterStore` resolves its data directory from `process.cwd()` when it is imported, so this file
// moves into a scratch folder first and imports it afterwards. The listing it caches is read from the
// real files, so the test builds real cards: a PNG with the `chara` chunk the app itself writes.

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

/** A 64x64 grey PNG carrying a character card, built the same way the app builds one. */
function cardPng(name: string, tags: string[] = []): Buffer {
  const size = 64;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size * 4; x++) raw[y * (size * 4 + 1) + 1 + x] = 120;
  }
  const base = Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return writeCharaChunk(base, JSON.stringify({ name, description: "", tags }));
}

const FIRST_ID = "11111111-1111-1111-1111-111111111111";
const SECOND_ID = "22222222-2222-2222-2222-222222222222";
const SYSTEM_ID = "33333333-3333-3333-3333-333333333333";
let root = "";
let store: typeof import("./characterStore.js");

const cardPath = (id: string) => path.join("data", "characters", `${id}.png`);

test.before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "silly-character-store-"));
  process.chdir(root);
  await mkdir(path.join("data", "characters"), { recursive: true });
  await writeFile(cardPath(FIRST_ID), cardPng("Ada", ["engineer"]));
  store = await import("./characterStore.js");
});

test.after(async () => {
  process.chdir(os.tmpdir());
  await rm(root, { recursive: true, force: true });
});

test("lists a card with its name, tags and mtime", async () => {
  const cards = await store.listCharacters();
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, FIRST_ID);
  assert.equal(cards[0].name, "Ada");
  assert.deepEqual(cards[0].tags, ["engineer"]);
  assert.ok(cards[0].mtimeMs > 0, "the summary carries the source mtime the avatars are pinned to");
  assert.equal(cards[0].isSystem, false);
});

test("marks the shipped Guide card as a system character", async () => {
  await writeFile(cardPath(SYSTEM_ID), cardPng("Pliego Lab Guide"));
  const cards = await store.listCharacters();
  const guide = cards.find((card) => card.id === SYSTEM_ID);
  assert.equal(guide?.isSystem, true);
  await rm(cardPath(SYSTEM_ID));
  await store.listCharacters();
});

test("answers from memory while the files are unchanged", async () => {
  const first = await store.listCharacters();
  const second = await store.listCharacters();
  // The same array instance means the cards were not read again: reading them costs ~460 MB on a
  // real library, which is what made the first version of this take 1.8 s per call.
  assert.equal(first, second);
});

test("three simultaneous calls share one read", async () => {
  const [a, b, c] = await Promise.all([store.listCharacters(), store.listCharacters(), store.listCharacters()]);
  assert.equal(a, b);
  assert.equal(b, c);
});

test("notices an edited card", async () => {
  const before = await store.listCharacters();
  await writeFile(cardPath(FIRST_ID), cardPng("Ada Lovelace", ["engineer", "poet"]));
  const future = new Date(Date.now() + 2000);
  await utimes(cardPath(FIRST_ID), future, future);

  const after = await store.listCharacters();
  assert.notEqual(after, before, "an edited card must produce a fresh listing");
  assert.equal(after.length, 1);
  assert.equal(after[0].name, "Ada Lovelace");
  assert.deepEqual(after[0].tags, ["engineer", "poet"]);
});

test("notices a card added and one deleted", async () => {
  await writeFile(cardPath(SECOND_ID), cardPng("Grace"));
  const withBoth = await store.listCharacters();
  assert.deepEqual(withBoth.map((card) => card.name).sort(), ["Ada Lovelace", "Grace"]);

  await rm(cardPath(SECOND_ID));
  const withOne = await store.listCharacters();
  assert.deepEqual(withOne.map((card) => card.name), ["Ada Lovelace"]);
});
