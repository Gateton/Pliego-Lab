import { Router } from "express";
import * as addonsSettingsStore from "../services/addonsSettingsStore.js";
import type { AddonsSettings } from "../types.js";

/** Estudio's rule-pack surface. Built-in prompts stay internal; the UI exposes metadata only. */
export const estudioRouter = Router();

estudioRouter.get("/addons/settings", async (_req, res) => {
  res.json(await addonsSettingsStore.getAddonsSettings());
});

estudioRouter.put("/addons/settings", async (req, res) => {
  const settings = req.body as AddonsSettings;
  if (typeof settings.enabled !== "boolean" || !Array.isArray(settings.activeAddonIds) || !Array.isArray(settings.addons)) {
    res.status(400).json({ error: "Invalid Add-ons settings" });
    return;
  }
  res.json(await addonsSettingsStore.updateAddonsSettings(settings));
});
