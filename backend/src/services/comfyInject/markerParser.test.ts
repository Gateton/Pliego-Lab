import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMarkerContent, parseSingleMarker, hasImageMarker } from "./markerParser.js";

test("applies defaults when AR/SHOT/SEED are omitted", () => {
  const result = parseMarkerContent("1girl, smiling");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.prompt, "1girl, smiling");
  assert.equal(result.ar, "SQUARE");
  assert.equal(result.shot, "MEDIUM");
  assert.equal(result.seedToken, "RANDOM");
  assert.deepEqual(result.repairMeta.defaulted, ["AR", "SHOT", "SEED"]);
});

test("classifies whole pipe segments as exact tokens", () => {
  const result = parseMarkerContent("1girl, smiling | PORTRAIT | CLOSE | 12345");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.prompt, "1girl, smiling");
  assert.equal(result.ar, "PORTRAIT");
  assert.equal(result.shot, "CLOSE");
  assert.equal(result.seedToken, "12345");
  assert.deepEqual(result.repairMeta.defaulted, []);
});

test("classifies tokens mixed into a comma part, keeping the rest as prompt", () => {
  const result = parseMarkerContent("1girl, PORTRAIT, smiling, CLOSE");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.ar, "PORTRAIT");
  assert.equal(result.shot, "CLOSE");
  assert.equal(result.prompt, "1girl, smiling");
});

test("classifies tokens mixed into a whitespace-separated word list", () => {
  const result = parseMarkerContent("a cat sitting POV LOCK on a chair");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.shot, "POV");
  assert.equal(result.seedToken, "LOCK");
  assert.equal(result.prompt, "a cat sitting on a chair");
});

test("does not treat standalone numbers inside prose as a seed at word level", () => {
  const result = parseMarkerContent("a room with 42 candles");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.seedToken, "RANDOM");
  assert.equal(result.prompt, "a room with 42 candles");
});

test("first valid token per field wins, duplicates are tracked", () => {
  const result = parseMarkerContent("1girl | PORTRAIT | SQUARE | CLOSE");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.ar, "PORTRAIT");
  assert.deepEqual(result.repairMeta.duplicateTokens.AR, ["SQUARE"]);
  assert.equal(result.shot, "CLOSE");
});

test("empty marker content is a parse_error", () => {
  const result = parseMarkerContent("   ");
  assert.equal(result.status, "parse_error");
  if (result.status !== "parse_error") return;
  assert.equal(result.reason, "empty_marker");
});

test("marker with only control tokens and no prompt text is a parse_error", () => {
  const result = parseMarkerContent("PORTRAIT | CLOSE | RANDOM");
  assert.equal(result.status, "parse_error");
  if (result.status !== "parse_error") return;
  assert.equal(result.reason, "empty_prompt");
});

test("hasImageMarker detects a marker in surrounding prose", () => {
  assert.equal(hasImageMarker("narración [[IMG: 1girl]] más texto"), true);
  assert.equal(hasImageMarker("sin marcadores acá"), false);
});

test("parseSingleMarker parses a full raw marker string", () => {
  const result = parseSingleMarker("[[IMG: 1girl | PORTRAIT]]");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.prompt, "1girl");
  assert.equal(result.ar, "PORTRAIT");
});

test("parseSingleMarker rejects a string without marker delimiters", () => {
  const result = parseSingleMarker("not a marker");
  assert.equal(result.status, "parse_error");
  if (result.status !== "parse_error") return;
  assert.equal(result.reason, "invalid_marker");
});
