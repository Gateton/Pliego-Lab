import { Router } from "express";
import { generateChatTitle } from "../services/title.js";
import { getSettings } from "../services/settingsStore.js";
import { listSamplingPresets } from "../services/samplingPresetStore.js";
import { resolvePreset } from "../services/presetDefaults.js";

export const titleRouter = Router();

// Generates a chat title from the first user message. Returns { title: null } when every
// candidate model fails, so the caller keeps its own default.
titleRouter.post("/", async (req, res) => {
  const { characterName, text } = req.body as { characterName?: string; text?: string };
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const settings = await getSettings();
  const presets = await listSamplingPresets();
  const preset = resolvePreset(presets, settings.activeSamplingPresetId);
  const title = await generateChatTitle(characterName ?? "", text, preset.model);
  res.json({ title });
});
