import test from "node:test";
import assert from "node:assert/strict";
import { newLorebookEntry, normalizeLorebook } from "./lorebooks.js";

test("normalizes a SillyTavern world-info object without discarding unknown fields", () => {
  const book = normalizeLorebook({
    name: "Academia",
    extensions: { category: "setting" },
    entries: {
      "7": {
        uid: 7,
        key: ["academy"],
        keysecondary: ["uniform"],
        comment: "Campus",
        content: "The academy is old.",
        selectiveLogic: 1,
        position: 4,
        extensions: { scan_depth: 8, future_flag: true },
        futureProperty: "preserve me",
      },
    },
  });
  assert.equal(book.name, "Academia");
  assert.deepEqual(book.entries["7"].key, ["academy"]);
  assert.equal(book.entries["7"].position, 4);
  assert.equal(book.entries["7"].futureProperty, "preserve me");
  assert.deepEqual(book.entries["7"].extensions, { scan_depth: 8, future_flag: true });
});

test("normalizes Character Card V2 array entries", () => {
  const book = normalizeLorebook({ entries: [{ id: 9, keys: ["legacy"], content: "Lore" }] }, "Embedded", "character");
  assert.equal(Object.keys(book.entries).length, 1);
  assert.equal(book.entries["9"].content, "Lore");
  assert.deepEqual(book.entries["9"].key, ["legacy"]);
});

test("new entries use SillyTavern-compatible defaults", () => {
  const entry = newLorebookEntry(3);
  assert.equal(entry.uid, 3);
  assert.equal(entry.order, 100);
  assert.equal(entry.probability, 100);
  assert.equal(entry.depth, 4);
  assert.equal(entry.selectiveLogic, 0);
});
