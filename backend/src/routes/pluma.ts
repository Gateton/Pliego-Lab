import { Router } from "express";
import * as plumaSettingsStore from "../services/plumaSettingsStore.js";
import type { PlumaSettings } from "../types.js";

/** Pluma: user-defined writing format rules (narration, dialogue, sounds) appended to the prompt. */
export const plumaRouter = Router();

plumaRouter.get("/settings", async (_req, res) => {
  res.json(await plumaSettingsStore.getPlumaSettings());
});

plumaRouter.put("/settings", async (req, res) => {
  const settings = req.body as PlumaSettings;
  if (typeof settings.enabled !== "boolean" || !Array.isArray(settings.rules)) {
    res.status(400).json({ error: "Invalid Pluma settings" });
    return;
  }
  res.json(await plumaSettingsStore.updatePlumaSettings(settings));
});
