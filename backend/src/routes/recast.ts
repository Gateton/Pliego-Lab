import { Router } from "express";
import * as settingsStore from "../services/recastSettingsStore.js";
import * as presetStore from "../services/recastPresetStore.js";
import { runRecastPipeline, type RecastPassRequest } from "../services/recast/pipeline.js";
import { recordUsage } from "../services/usageStore.js";
import type { RecastPass, RecastSettings } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const recastRouter = Router();

recastRouter.get("/settings", async (_req, res) => {
  res.json(await settingsStore.getRecastSettings());
});

recastRouter.put("/settings", async (req, res) => {
  const settings = req.body as RecastSettings;
  if (typeof settings.enabled !== "boolean" || typeof settings.minChars !== "number") {
    res.status(400).json({ error: "Invalid Recast settings" });
    return;
  }
  res.json(await settingsStore.updateRecastSettings(settings));
});

recastRouter.get("/presets", async (_req, res) => {
  res.json(await presetStore.listRecastPresets());
});

recastRouter.post("/presets", async (req, res) => {
  const { name, passes } = req.body as { name?: string; passes?: unknown };
  if (typeof name !== "string" || !name.trim() || !Array.isArray(passes)) {
    res.status(400).json({ error: "name and passes are required" });
    return;
  }
  res.status(201).json(await presetStore.createRecastPreset({ name, passes: passes as RecastPass[] }));
});

recastRouter.put("/presets/:id", async (req, res) => {
  const { name, passes } = req.body as { name?: string; passes?: unknown };
  if (typeof name !== "string" || !name.trim() || !Array.isArray(passes)) {
    res.status(400).json({ error: "name and passes are required" });
    return;
  }
  const preset = await presetStore.updateRecastPreset(req.params.id, { name, passes: passes as RecastPass[] });
  if (!preset) {
    res.status(404).json(apiErrorBody("recast.presetNotFound"));
    return;
  }
  res.json(preset);
});

recastRouter.delete("/presets/:id", async (req, res) => {
  const deleted = await presetStore.deleteRecastPreset(req.params.id);
  if (!deleted) {
    res.status(404).json(apiErrorBody("recast.presetNotFound"));
    return;
  }
  res.status(204).end();
});

recastRouter.post("/process", async (req, res) => {
  const { text, passes, chatId } = req.body as { text?: string; passes?: RecastPassRequest[]; chatId?: string };
  if (typeof text !== "string" || !Array.isArray(passes)) {
    res.status(400).json({ error: "text and passes are required" });
    return;
  }

  const settings = await settingsStore.getRecastSettings();
  if (!settings.enabled) {
    res.status(409).json(apiErrorBody("recast.disabled"));
    return;
  }

  const { text: finalText, snapshots, usages } = await runRecastPipeline(text, passes);
  for (const { provider, model, usage } of usages) {
    await recordUsage({ chatId: chatId ?? null, stage: "recast", provider, model, ...usage, timestamp: Date.now() });
  }
  res.json({ text: finalText, snapshots });
});
