import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let root = "";
let seed: typeof import("./seedDefaultSamplingPreset.js");
let presets: typeof import("./samplingPresetStore.js");
let settings: typeof import("./settingsStore.js");
let addons: typeof import("./addonsSettingsStore.js");
let pluma: typeof import("./plumaSettingsStore.js");

test.before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "pliego-default-settings-"));
  process.chdir(root);
  seed = await import("./seedDefaultSamplingPreset.js");
  presets = await import("./samplingPresetStore.js");
  settings = await import("./settingsStore.js");
  addons = await import("./addonsSettingsStore.js");
  pluma = await import("./plumaSettingsStore.js");
});

test.after(async () => {
  process.chdir(os.tmpdir());
  await rm(root, { recursive: true, force: true });
});

test("seeds a provider-free public Default preset and selects it", async () => {
  const created = await seed.seedDefaultSamplingPreset();
  assert.equal(created.name, "Default");
  assert.equal(created.model, undefined);
  assert.equal(created.temperature, 0.9);
  assert.equal(created.frequency_penalty, 0);
  assert.equal(created.max_tokens, 20000);
  assert.equal(created.maxContextTokens, 200000);
  assert.equal((await settings.getSettings()).activeSamplingPresetId, created.id);

  await seed.seedDefaultSamplingPreset();
  assert.equal((await presets.listSamplingPresets()).length, 1);
});

test("seeds the active Estudio packs and English Pluma rules", async () => {
  const estudio = await addons.getAddonsSettings();
  assert.equal(estudio.enabled, true);
  assert.deepEqual(estudio.activeAddonIds, ["html", "direct"]);
  assert.deepEqual(
    estudio.addons.map((addon) => addon.name),
    [
      "Dice: You Only",
      "Dice: Everyone",
      "Immersive HTML",
      "Real Death",
      "Realistic Combat",
      "Direct Language",
      "Character Colors",
    ],
  );

  const writing = await pluma.getPlumaSettings();
  assert.equal(writing.enabled, true);
  assert.deepEqual(
    writing.rules.map((rule) => ({ id: rule.id, enabled: rule.enabled, title: rule.title })),
    [
      { id: "narracion", enabled: true, title: "Narration" },
      { id: "dialogo", enabled: true, title: "Dialogue" },
      { id: "sonidos", enabled: true, title: "Sounds" },
      { id: "prohibido-raya", enabled: false, title: "Forbidden" },
      { id: "pensamientos", enabled: false, title: "Thoughts" },
      { id: "ooc", enabled: false, title: "OOC" },
      { id: "longitud", enabled: false, title: "Paragraphs" },
      { id: "silencios", enabled: false, title: "Pauses" },
      { id: "transicion", enabled: false, title: "Transition" },
    ],
  );
  assert.ok(writing.rules.every((rule) => !/[áéíóúñ¿¡]/i.test(`${rule.title} ${rule.instruction} ${rule.example}`)));
});

test("retired built-in packs disappear from an install that already stored them", async () => {
  await mkdir(path.join(root, "data"), { recursive: true });
  await writeFile(
    path.join(root, "data", "addonsSettings.json"),
    JSON.stringify({
      enabled: true,
      activeAddonIds: ["html", "npc_events", "mine"],
      addons: [
        { id: "html", name: "Immersive HTML (stale)", trigger: "[[html]]", builtin: true, content: "stale copy" },
        { id: "npc_events", name: "Organic NPCs and Events", trigger: "[[npc_events]]", builtin: true, content: "retired pack" },
        { id: "mine", name: "My pack", trigger: "[[mine]]", content: "custom" },
      ],
    }),
  );

  const estudio = await addons.getAddonsSettings();
  assert.deepEqual(estudio.activeAddonIds, ["html", "mine"]);
  assert.deepEqual(
    estudio.addons.map((addon) => addon.id),
    ["html", "mine", "dice", "dice_all", "death", "combat", "direct", "color"],
  );
  assert.ok(!estudio.addons[0].content.includes("stale copy"));
});
