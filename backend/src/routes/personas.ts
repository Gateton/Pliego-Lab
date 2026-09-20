import { Router } from "express";
import * as personaStore from "../services/personaStore.js";
import * as npcTrackerSettingsStore from "../services/npcTrackerSettingsStore.js";
import { generatePersonaDossier } from "../services/npcScanner.js";
import { recordUsage } from "../services/usageStore.js";
import { apiErrorBody } from "../services/apiError.js";

export const personasRouter = Router();

personasRouter.get("/", async (_req, res) => {
  res.json(await personaStore.listPersonas());
});

personasRouter.post("/", async (req, res) => {
  const { name, description, avatar, values, lorebookId } = req.body as {
    name?: string;
    description?: string;
    avatar?: string;
    values?: Record<string, string>;
    lorebookId?: string | null;
  };
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  res.status(201).json(await personaStore.createPersona({ name, description, avatar, values, lorebookId }));
});

personasRouter.put("/:id", async (req, res) => {
  const { name, description, avatar, values, lorebookId } = req.body as {
    name?: string;
    description?: string;
    avatar?: string;
    values?: Record<string, string>;
    lorebookId?: string | null;
  };
  if (typeof name !== "string" || typeof description !== "string") {
    res.status(400).json({ error: "name and description are required" });
    return;
  }
  const persona = await personaStore.updatePersona(req.params.id, { name, description, avatar, values, lorebookId });
  if (!persona) {
    res.status(404).json(apiErrorBody("persona.notFound"));
    return;
  }
  res.json(persona);
});

// Generates a full persona dossier (same field schema as NPC Tracker) from a free-text
// description — deliberately NOT tied to a persisted persona id, so it works both when
// creating a brand-new persona and when re-generating an existing one's fields, before the
// user has necessarily saved. Unlike NPC/Character dossier generation (which must never invent
// beyond real story content), this one is explicitly meant to flesh out a rough sketch, so
// reasonable creative extrapolation is the intended behavior here, not a bug.
personasRouter.post("/generate-dossier", async (req, res) => {
  const { description } = req.body as { description?: string };
  if (!description || !description.trim()) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const settings = await npcTrackerSettingsStore.getNpcTrackerSettings();
  try {
    const { values, meta } = await generatePersonaDossier({ description, fields: settings.fields, model: settings.model });
    await recordUsage({ chatId: null, stage: "characterGen", provider: meta.provider, model: meta.model, ...meta.usage, timestamp: Date.now() });
    res.json({ values });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Persona generation failed" });
  }
});

personasRouter.delete("/:id", async (req, res) => {
  const deleted = await personaStore.deletePersona(req.params.id);
  if (!deleted) {
    res.status(404).json(apiErrorBody("persona.notFound"));
    return;
  }
  res.status(204).end();
});
