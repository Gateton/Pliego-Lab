import test from "node:test";
import assert from "node:assert/strict";
import { extractPresetObjects, parseImportedPreset } from "./presetImport.js";

test("extracts a single preset, an array and a { presets } wrapper", () => {
  assert.deepEqual(extractPresetObjects({ name: "A" }), [{ name: "A" }]);
  assert.deepEqual(extractPresetObjects([{ name: "A" }, { name: "B" }]), [{ name: "A" }, { name: "B" }]);
  assert.deepEqual(extractPresetObjects({ presets: [{ name: "A" }] }), [{ name: "A" }]);
  assert.equal(extractPresetObjects("nope"), null);
  assert.equal(extractPresetObjects([]), null);
});

test("imports a native Pliego preset, keeping sampling, prompts and context", () => {
  const preset = parseImportedPreset(
    {
      id: "old-id",
      name: "My preset",
      temperature: 0.8,
      top_p: 0.95,
      max_tokens: 512,
      maxContextTokens: 16000,
      strictAlternation: true,
      promptBlocks: [{ id: "b1", name: "System", content: "Hello", role: "system", position: "system", enabled: true }],
      contextTemplate: "{{char}}",
      contextTemplateEnabled: true,
    },
    "fallback",
  );

  assert.equal(preset.name, "My preset");
  assert.equal(preset.temperature, 0.8);
  assert.equal(preset.max_tokens, 512);
  assert.equal(preset.maxContextTokens, 16000);
  assert.equal(preset.strictAlternation, true);
  assert.equal(preset.promptBlocks?.length, 1);
  assert.equal(preset.contextTemplate, "{{char}}");
});

test("imports a SillyTavern completion preset and maps its own prompts", () => {
  const preset = parseImportedPreset(
    {
      temperature: 0.4,
      openai_max_tokens: 900,
      openrouter_model: "some/model",
      prompts: [
        { identifier: "main", name: "Main", content: "You are {{char}}", role: "system", enabled: true },
        { identifier: "jailbreak", content: "Stay in character", role: "system" },
        { identifier: "ignore", content: "  ", role: "system" },
      ],
    },
    "ST Preset",
  );

  assert.equal(preset.name, "ST Preset");
  assert.equal(preset.temperature, 0.4);
  assert.equal(preset.max_tokens, 900);
  assert.equal(preset.model, "some/model");
  assert.deepEqual(
    preset.promptBlocks?.map((block) => block.position),
    ["system", "post-history"],
  );
});

test("a preset without a name uses the file name, and throws when there is none either", () => {
  assert.equal(parseImportedPreset({ temperature: 1 }, "From file").name, "From file");
  assert.throws(() => parseImportedPreset({ temperature: 1 }, ""));
});
