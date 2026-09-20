import { Router } from "express";
import * as imageDirectorSettingsStore from "../services/imageDirectorSettingsStore.js";
import { recordUsage } from "../services/usageStore.js";
import { runImageDirector, runDirectorReaction, checkVisualState } from "../services/imageDirector.js";
import { listModels } from "../services/llm.js";
import type { CharacterVisualState, ImageDirectorSettings } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

/** Image Director: a secondary model that inserts [[IMG:...]] markers for ComfyInject to render. */
export const imageDirectorRouter = Router();

interface DirectorContext {
  character?: { name: string; description: string; personality: string; scenario: string; imageTags: string };
  npcs?: Array<{ name: string; values: Record<string, string> }>;
  persona?: { name: string; imageTags: string };
  recentMessages?: Array<{ role: string; content: string }>;
  visualState?: Record<string, CharacterVisualState>;
  chatId?: string;
}

imageDirectorRouter.get("/settings", async (_req, res) => {
  res.json(await imageDirectorSettingsStore.getImageDirectorSettings());
});

imageDirectorRouter.put("/settings", async (req, res) => {
  const settings = req.body as ImageDirectorSettings;
  if (typeof settings.enabled !== "boolean") {
    res.status(400).json({ error: "Invalid Image Director settings" });
    return;
  }
  res.json(await imageDirectorSettingsStore.updateImageDirectorSettings(settings));
});

imageDirectorRouter.post("/run", async (req, res) => {
  const { text, character, npcs, persona, recentMessages, visualState, chatId } = req.body as DirectorContext & { text?: string };
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const settings = await imageDirectorSettingsStore.getImageDirectorSettings();
  if (!settings.enabled) {
    res.status(409).json(apiErrorBody("director.disabled"));
    return;
  }
  if (!settings.model) {
    res.status(400).json(apiErrorBody("director.noModel"));
    return;
  }

  // Lets the caller cancel a run in progress: aborting the client's fetch closes this connection,
  // which we use to abort the in-flight LLM call instead of just abandoning the wait client-side.
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  try {
    const { taggedText, stateUpdates, meta, diagnostic } = await runImageDirector(
      text,
      settings,
      { character, npcs, persona, recentMessages, visualState },
      controller.signal,
    );
    await recordUsage({ chatId: chatId ?? null, stage: "director", provider: meta.provider, model: meta.model, ...meta.usage, timestamp: Date.now() });
    res.json({ taggedText, stateUpdates, diagnostic });
  } catch (error) {
    if (controller.signal.aborted) return; // Client already disconnected — nothing to respond to.
    res.status(502).json({ error: (error as Error).message });
  }
});

imageDirectorRouter.post("/check-visual-state", async (req, res) => {
  const { text, character, npcs, persona, recentMessages, visualState, chatId } = req.body as DirectorContext & { text?: string };
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const settings = await imageDirectorSettingsStore.getImageDirectorSettings();
  if (!settings.enabled) {
    res.status(409).json(apiErrorBody("director.disabled"));
    return;
  }
  if (!settings.model) {
    res.status(400).json(apiErrorBody("director.noModel"));
    return;
  }

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  try {
    const { stateUpdates, meta } = await checkVisualState(
      text,
      settings,
      { character, npcs, persona, recentMessages, visualState },
      controller.signal,
    );
    await recordUsage({ chatId: chatId ?? null, stage: "director", provider: meta.provider, model: meta.model, ...meta.usage, timestamp: Date.now() });
    res.json({ stateUpdates });
  } catch (error) {
    if (controller.signal.aborted) return;
    res.status(502).json({ error: (error as Error).message });
  }
});

imageDirectorRouter.post("/react", async (req, res) => {
  const { npc, lastMessageText, chatId } = req.body as {
    npc?: { name: string; values: Record<string, string> };
    lastMessageText?: string;
    chatId?: string;
  };
  if (!npc?.name || typeof lastMessageText !== "string") {
    res.status(400).json({ error: "npc and lastMessageText are required" });
    return;
  }

  const settings = await imageDirectorSettingsStore.getImageDirectorSettings();
  if (!settings.enabled) {
    res.status(409).json(apiErrorBody("director.disabled"));
    return;
  }
  if (!settings.model) {
    res.status(400).json(apiErrorBody("director.noModel"));
    return;
  }

  try {
    const { marker, meta } = await runDirectorReaction(npc, lastMessageText, settings);
    await recordUsage({ chatId: chatId ?? null, stage: "director", provider: meta.provider, model: meta.model, ...meta.usage, timestamp: Date.now() });
    res.json({ marker });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message });
  }
});

imageDirectorRouter.get("/models", async (_req, res) => {
  try {
    res.json(await listModels());
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
