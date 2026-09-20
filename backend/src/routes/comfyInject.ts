import { readdir } from "node:fs/promises";
import path from "node:path";
import express, { Router } from "express";
import * as settingsStore from "../services/comfyInjectSettingsStore.js";
import * as chatStore from "../services/chatStore.js";
import { processAllImageMarkers, retrySingleMarker, generateSingleMarker } from "../services/comfyInject/orchestrator.js";
import { fetchObjectInfoOptions, generateImage, ComfyClientError } from "../services/comfyInject/comfyClient.js";
import { IMAGES_DIR } from "../services/comfyInject/imageCache.js";
import { getGeneratedImageThumbnail } from "../services/comfyInject/imageThumbnails.js";
import { parseThumbnailSize } from "../services/thumbnailCache.js";
import type { ComfyInjectSettings } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const comfyInjectRouter = Router();

const WORKFLOWS_DIR = path.resolve(process.cwd(), "assets", "comfy-workflows");

/**
 * Generated pictures, full size or as a square for the gallery.
 *
 * `?w=` asks for a downscaled copy, which is what the gallery grid uses: it crops each picture to a
 * square, and a chat can hold hundreds of 1.3 MB originals. Without `?w=` the file itself is served,
 * which is what the chat shows (the illustration is meant to be read at full size) and what the
 * lightbox opens.
 */
comfyInjectRouter.get("/images/:file", async (req, res, next) => {
  const size = parseThumbnailSize(req.query.w);
  if (size === null) {
    next();
    return;
  }

  const thumbnail = await getGeneratedImageThumbnail(req.params.file, size);
  if (!thumbnail) {
    // Unknown or unsupported name: the static handler below answers (or 404s) instead.
    next();
    return;
  }

  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(thumbnail.buffer);
});

// Cached images are named with a UUID and never rewritten, so the browser can keep them for good
// instead of revalidating every generated picture on every chat scroll.
comfyInjectRouter.use("/images", express.static(IMAGES_DIR, { maxAge: "365d", immutable: true }));

comfyInjectRouter.get("/settings", async (_req, res) => {
  res.json(await settingsStore.getComfyInjectSettings());
});

comfyInjectRouter.put("/settings", async (req, res) => {
  const settings = req.body as ComfyInjectSettings;
  if (typeof settings.enabled !== "boolean" || typeof settings.comfy_host !== "string") {
    res.status(400).json({ error: "Invalid ComfyInject settings" });
    return;
  }
  res.json(await settingsStore.updateComfyInjectSettings(settings));
});

comfyInjectRouter.get("/workflows", async (_req, res) => {
  const files = (await readdir(WORKFLOWS_DIR)).filter((f) => f.endsWith(".json"));
  res.json(files);
});

comfyInjectRouter.get("/checkpoints", async (_req, res) => {
  const settings = await settingsStore.getComfyInjectSettings();
  res.json(await fetchObjectInfoOptions("CheckpointLoaderSimple", "ckpt_name", settings.comfy_host));
});

comfyInjectRouter.get("/diffusion-models", async (_req, res) => {
  const settings = await settingsStore.getComfyInjectSettings();
  res.json(await fetchObjectInfoOptions("UNETLoader", "unet_name", settings.comfy_host));
});

comfyInjectRouter.get("/text-encoders", async (_req, res) => {
  const settings = await settingsStore.getComfyInjectSettings();
  res.json(await fetchObjectInfoOptions("CLIPLoader", "clip_name", settings.comfy_host));
});

comfyInjectRouter.get("/vaes", async (_req, res) => {
  const settings = await settingsStore.getComfyInjectSettings();
  res.json(await fetchObjectInfoOptions("VAELoader", "vae_name", settings.comfy_host));
});

comfyInjectRouter.get("/loras", async (_req, res) => {
  const settings = await settingsStore.getComfyInjectSettings();
  res.json(await fetchObjectInfoOptions("LoraLoader", "lora_name", settings.comfy_host));
});

// Manual test generation — bypasses chats/markers entirely, calls the exact same generateImage()
// the real pipeline uses (so an active style preset, prepend/append prompts, shot tags and the
// enhancer all apply exactly as they would for real), and reports back what was ACTUALLY used
// (post-preset-override) so a silently-active preset overriding the base tabs is visible here
// instead of only showing up as "my settings don't seem to apply" confusion.
comfyInjectRouter.post("/test-generate", async (req, res) => {
  const { prompt, ar, shot, seed, width, height } = req.body as {
    prompt?: string;
    ar?: string;
    shot?: string;
    seed?: number;
    width?: number;
    height?: number;
  };
  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const settings = await settingsStore.getComfyInjectSettings();
  if (!settings.comfy_host) {
    res.status(400).json(apiErrorBody("comfy.hostNotConfigured"));
    return;
  }

  try {
    const effectiveSeed = typeof seed === "number" && Number.isFinite(seed) ? seed : Math.floor(Math.random() * 9007199254740991);
    const hasCustomResolution = typeof width === "number" && width > 0 && typeof height === "number" && height > 0;
    const result = await generateImage(
      {
        prompt,
        ar: ar || "SQUARE",
        shot: shot || "MEDIUM",
        seed: effectiveSeed,
        ...(hasCustomResolution ? { width, height } : {}),
      },
      settings,
    );
    res.json(result);
  } catch (error) {
    const message = error instanceof ComfyClientError ? error.message : error instanceof Error ? error.message : "Test generation failed";
    res.status(502).json({ error: message });
  }
});

comfyInjectRouter.post("/process-message", async (req, res) => {
  const { text, chatId, beforeMessageId } = req.body as {
    text?: string;
    chatId?: string;
    beforeMessageId?: string;
  };

  if (typeof text !== "string" || typeof chatId !== "string") {
    res.status(400).json({ error: "text and chatId are required" });
    return;
  }

  const settings = await settingsStore.getComfyInjectSettings();
  if (!settings.enabled) {
    res.status(409).json(apiErrorBody("comfy.disabled"));
    return;
  }

  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const results = await processAllImageMarkers(text, settings, chat, beforeMessageId);
  res.json(results);
});

comfyInjectRouter.post("/retry-marker", async (req, res) => {
  const { rawMarker, chatId, beforeMessageId } = req.body as {
    rawMarker?: string;
    chatId?: string;
    beforeMessageId?: string;
  };

  if (typeof rawMarker !== "string" || typeof chatId !== "string") {
    res.status(400).json({ error: "rawMarker and chatId are required" });
    return;
  }

  const settings = await settingsStore.getComfyInjectSettings();
  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const result = await retrySingleMarker(rawMarker, settings, chat, beforeMessageId);
  res.json(result);
});

comfyInjectRouter.post("/generate-marker", async (req, res) => {
  const { rawMarker, chatId, beforeMessageId } = req.body as {
    rawMarker?: string;
    chatId?: string;
    beforeMessageId?: string;
  };

  if (typeof rawMarker !== "string" || typeof chatId !== "string") {
    res.status(400).json({ error: "rawMarker and chatId are required" });
    return;
  }

  const settings = await settingsStore.getComfyInjectSettings();
  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const result = await generateSingleMarker(rawMarker, settings, chat, beforeMessageId);
  res.json(result);
});
