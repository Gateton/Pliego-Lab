import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeImageMarker, sanitizeImageMarkers, sanitizeTagList } from "./directorTags.js";
import { enhancePrompt } from "./comfyInject/promptEnhancer.js";

test("negations, sentences, underscores and repeats are removed; real Danbooru negations stay", () => {
  const { tags, dropped } = sanitizeTagList(
    "1girl, long_blonde_hair, no underwear, no bra, without shoes, dress removed, Long blonde hair, wet hair, a girl who is waiting for orders from her new master, no humans",
  );
  assert.deepEqual(tags, ["1girl", "long blonde hair", "no bra", "wet hair", "no humans"]);
  assert.deepEqual(dropped, ["no underwear", "without shoes", "dress removed", "a girl who is waiting for orders from her new master"]);
});

test("a marker keeps its control fields untouched", () => {
  const { marker } = sanitizeImageMarker("[[IMG: 1girl, no underwear, kneeling | PORTRAIT | MEDIUM | LOCK]]");
  assert.equal(marker, "[[IMG: 1girl, kneeling | PORTRAIT | MEDIUM | LOCK]]");
  const clean = "[[IMG: 1girl, kneeling | PORTRAIT | MEDIUM | RANDOM]]";
  assert.equal(sanitizeImageMarker(clean).marker, clean);
});

test("every marker in a text is cleaned and the prose is left alone", () => {
  const { text } = sanitizeImageMarkers("Ella se arrodilla. [[IMG: 1girl, no panties, no underwear | SQUARE | CLOSE | RANDOM]] Fin, no más.");
  assert.equal(text, "Ella se arrodilla. [[IMG: 1girl, no panties | SQUARE | CLOSE | RANDOM]] Fin, no más.");
});

test("the enhancer never lights a scene that already has lighting", () => {
  const prompt = "masterpiece, 1girl, night, heavy rain, glowing eyes, soft skin, cold blue light";
  assert.equal(enhancePrompt(prompt), prompt);
});

test("the enhancer matches whole tags, and weather wins over time of day", () => {
  assert.ok(enhancePrompt("masterpiece, 1girl, night, rain").endsWith("overcast, dim lighting"));
  assert.ok(!enhancePrompt("masterpiece, 1girl, soft skin, glowing eyes").includes("light"));
  assert.ok(!enhancePrompt("masterpiece, 1girl, night").includes("starry sky"));
});

test("the scene snapshot is normalized, capped and absent when the Director skipped it", async () => {
  const { parseSceneLedger } = await import("./imageDirector.js");
  assert.equal(parseSceneLedger(undefined), undefined);
  assert.equal(parseSceneLedger("nope"), undefined);
  const scene = parseSceneLedger(
    {
      positions: { " Iris ": "  kneeling on the bed,\n wrists tied ", Daren: 42, "": "x" },
      objects: ["silk rope — on Iris's wrists", 7, "", ...Array.from({ length: 12 }, (_, i) => `prop ${i}`)],
    },
    5,
  );
  assert.deepEqual(scene?.positions, { Iris: "kneeling on the bed, wrists tied" });
  assert.equal(scene?.objects[0], "silk rope — on Iris's wrists");
  assert.equal(scene?.objects.length, 10);
  assert.equal(scene?.updatedAt, 5);
});
