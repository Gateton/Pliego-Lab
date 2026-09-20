import { Router } from "express";
import * as presetStore from "../services/samplingPresetStore.js";
import { parsePresetFields } from "../services/samplingPresetFields.js";
import { extractPresetObjects, parseImportedPreset } from "../services/presetImport.js";
import type { SamplingPreset } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const samplingPresetsRouter = Router();

samplingPresetsRouter.get("/", async (_req, res) => {
  res.json(await presetStore.listSamplingPresets());
});

samplingPresetsRouter.post("/", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const preset = await presetStore.createSamplingPreset({ name, ...parsePresetFields(req.body) });
  res.status(201).json(preset);
});

// Import from an uploaded JSON file. The body carries the already-parsed file plus the file name,
// used as the fallback when the preset itself has no `name` (SillyTavern presets usually do not).
samplingPresetsRouter.post("/import", async (req, res) => {
  const { name, data } = req.body as { name?: string; data?: unknown };
  const objects = extractPresetObjects(data);
  if (!objects) {
    res.status(400).json(apiErrorBody("preset.importInvalid"));
    return;
  }

  const fallbackName = typeof name === "string" ? name.trim() : "";
  const imported: SamplingPreset[] = [];
  const errors: string[] = [];

  for (const [index, object] of objects.entries()) {
    try {
      const fields = parseImportedPreset(object, fallbackName || `Preset ${index + 1}`);
      imported.push(await presetStore.createSamplingPreset(fields));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown error");
    }
  }

  if (imported.length === 0) {
    res.status(400).json(apiErrorBody("preset.importInvalid"));
    return;
  }

  res.status(201).json({ imported, errors });
});

samplingPresetsRouter.put("/:id", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const preset = await presetStore.updateSamplingPreset(req.params.id, { name, ...parsePresetFields(req.body) });
  if (!preset) {
    res.status(404).json(apiErrorBody("preset.notFound"));
    return;
  }
  res.json(preset);
});

samplingPresetsRouter.delete("/:id", async (req, res) => {
  const deleted = await presetStore.deleteSamplingPreset(req.params.id);
  if (!deleted) {
    res.status(404).json(apiErrorBody("preset.notFound"));
    return;
  }
  res.status(204).end();
});
