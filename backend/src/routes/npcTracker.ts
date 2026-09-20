import { Router } from "express";
import * as settingsStore from "../services/npcTrackerSettingsStore.js";
import * as chatStore from "../services/chatStore.js";
import * as characterStore from "../services/characterStore.js";
import * as comfyInjectSettingsStore from "../services/comfyInjectSettingsStore.js";
import { generateImage } from "../services/comfyInject/comfyClient.js";
import { cacheImage } from "../services/comfyInject/imageCache.js";
import { scanForNpcs, regenerateNpcDossier, evolveNpcDossiers, consolidateNpcField, type ScanImage } from "../services/npcScanner.js";
import { recordUsage } from "../services/usageStore.js";
import type { Chat, NpcTrackerSettings } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const npcTrackerRouter = Router();

npcTrackerRouter.get("/settings", async (_req, res) => {
  res.json(await settingsStore.getNpcTrackerSettings());
});

npcTrackerRouter.put("/settings", async (req, res) => {
  const settings = req.body as NpcTrackerSettings;
  if (typeof settings.enabled !== "boolean" || !Array.isArray(settings.fields)) {
    res.status(400).json({ error: "Invalid NPC Tracker settings" });
    return;
  }
  res.json(await settingsStore.updateNpcTrackerSettings(settings));
});

/** Formats chat messages into a compact conversation string for the scanner. */
function buildConversationText(chat: Chat, sinceIndex: number): string {
  return chat.messages
    .slice(sinceIndex)
    .map((m) => `[${m.role === "user" ? "User" : "Assistant"}]\n${m.swipes[m.activeSwipeIndex] ?? ""}`)
    .join("\n\n");
}

/** Collects every successfully generated image's prompt+url for pfp matching. */
function collectImages(chat: Chat): ScanImage[] {
  const images: ScanImage[] = [];
  for (const m of chat.messages) {
    if (!m.images) continue;
    for (const result of Object.values(m.images)) {
      if (result.status === "ok" && result.url) images.push({ prompt: result.prompt, url: result.url });
    }
  }
  return images;
}

// Scans a chat for NPCs. `sinceIndex` (optional) limits the scan to messages from that index on —
// used by auto-scan to only look at new messages; a manual full scan omits it and covers everything.
npcTrackerRouter.post("/scan/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { characterName, personaName, sinceIndex } = req.body as {
    characterName?: string;
    personaName?: string;
    sinceIndex?: number;
  };

  const settings = await settingsStore.getNpcTrackerSettings();
  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }

  const from = typeof sinceIndex === "number" && sinceIndex >= 0 ? sinceIndex : 0;
  const text = buildConversationText(chat, from);
  if (!text.trim()) {
    res.json({ npcs: chat.npcs ?? [], added: 0, updated: 0 });
    return;
  }

  try {
    const character = chat.characterId ? await characterStore.readCharacter(chat.characterId) : null;
    // A "world"/scenario card (e.g. a whole setting like "Island Life") isn't a person — it has
    // no physical appearance, secrets, or mannerisms to track, so it's excluded from
    // includeMainCharacter entirely regardless of the global toggle, same as if it were off.
    const includeMainCharacter = settings.includeMainCharacter && !character?.isWorld;
    const mainCharacterCard = includeMainCharacter ? character : null;

    const result = await scanForNpcs({
      text,
      characterName: characterName ?? "",
      personaName,
      model: settings.model,
      fields: settings.fields,
      existingNpcs: chat.npcs ?? [],
      images: collectImages(chat),
      firstMessageIndex: from,
      includeMainCharacter,
      ...(mainCharacterCard
        ? {
            mainCharacterCard: {
              description: mainCharacterCard.description,
              personality: mainCharacterCard.personality,
              scenario: mainCharacterCard.scenario,
              imageTags: mainCharacterCard.imageTags,
            },
          }
        : {}),
    });

    await chatStore.updateChat(chatId, { npcs: result.npcs });
    await recordUsage({ chatId, stage: "npcTracker", provider: result.meta.provider, model: result.meta.model, ...result.meta.usage, timestamp: Date.now() });
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "NPC scan failed" });
  }
});

// Full rewrite of one NPC's dossier from the WHOLE conversation (not just since-last-scan) —
// only produces something real when run in the chat where the NPC actually has content; a
// Favoritos-imported copy in an unrelated chat will just come back mostly empty, by design.
npcTrackerRouter.post("/regenerate/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { npcId, npcName } = req.body as { npcId?: string; npcName?: string };
  if (!npcId || !npcName) {
    res.status(400).json({ error: "npcId and npcName are required" });
    return;
  }

  const settings = await settingsStore.getNpcTrackerSettings();
  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  const npc = (chat.npcs ?? []).find((n) => n.id === npcId);
  if (!npc) {
    res.status(404).json(apiErrorBody("npc.notFoundInChat"));
    return;
  }

  const fullConversationText = buildConversationText(chat, 0);
  try {
    const { values, meta } = await regenerateNpcDossier({
      npcName,
      fullConversationText,
      fields: settings.fields,
      model: settings.model,
    });
    const nextNpcs = (chat.npcs ?? []).map((n) => (n.id === npcId ? { ...n, values } : n));
    await chatStore.updateChat(chatId, { npcs: nextNpcs });
    await recordUsage({ chatId, stage: "npcTracker", provider: meta.provider, model: meta.model, ...meta.usage, timestamp: Date.now() });
    res.json({ npc: { ...npc, values } });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "NPC regeneration failed" });
  }
});

// Reviews a recent conversation excerpt and, unlike /scan, MAY overwrite existing dossier
// field values when the model reports a genuine change — never adds/removes NPCs. Deliberately
// isolated from scanForNpcs so this feature can't regress the existing detection behavior.
npcTrackerRouter.post("/evolve/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { sinceIndex } = req.body as { sinceIndex?: number };

  const settings = await settingsStore.getNpcTrackerSettings();
  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  if (!chat.npcs || chat.npcs.length === 0) {
    res.json({ npcs: chat.npcs ?? [], changed: 0 });
    return;
  }

  const from = typeof sinceIndex === "number" && sinceIndex >= 0 ? sinceIndex : 0;
  const recentText = buildConversationText(chat, from);
  if (!recentText.trim()) {
    res.json({ npcs: chat.npcs, changed: 0 });
    return;
  }

  try {
    const result = await evolveNpcDossiers({
      npcs: chat.npcs,
      recentText,
      fields: settings.fields,
      model: settings.model,
    });

    await chatStore.updateChat(chatId, { npcs: result.npcs });
    await recordUsage({ chatId, stage: "npcTracker", provider: result.meta.provider, model: result.meta.model, ...result.meta.usage, timestamp: Date.now() });
    res.json({ npcs: result.npcs, changed: result.changed });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "NPC evolution failed" });
  }
});

// Manually compacts one already-large append-only field for one NPC — same consolidation pass
// the automatic threshold trigger uses, exposed as an on-demand action so the user can force it
// before the automatic threshold is reached, or if they disabled the automatic trigger entirely.
npcTrackerRouter.post("/consolidate/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { npcId, fieldKey } = req.body as { npcId?: string; fieldKey?: string };
  if (!npcId || !fieldKey) {
    res.status(400).json({ error: "npcId and fieldKey are required" });
    return;
  }

  const settings = await settingsStore.getNpcTrackerSettings();
  const chat = await chatStore.readChat(chatId);
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  const npc = (chat.npcs ?? []).find((n) => n.id === npcId);
  if (!npc) {
    res.status(404).json(apiErrorBody("npc.notFoundInChat"));
    return;
  }
  const field = settings.fields.find((f) => f.key === fieldKey);
  const currentValue = npc.values[fieldKey];
  if (!field || !currentValue) {
    res.status(400).json({ error: "Field not found or empty" });
    return;
  }

  try {
    const { value, meta } = await consolidateNpcField({
      fieldLabel: field.label,
      kind: field.kind,
      currentValue,
      model: settings.model,
    });
    const nextNpcs = (chat.npcs ?? []).map((n) => (n.id === npcId ? { ...n, values: { ...n.values, [fieldKey]: value } } : n));
    await chatStore.updateChat(chatId, { npcs: nextNpcs });
    await recordUsage({ chatId, stage: "npcTracker", provider: meta.provider, model: meta.model, ...meta.usage, timestamp: Date.now() });
    res.json({ npc: { ...npc, values: { ...npc.values, [fieldKey]: value } } });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Field consolidation failed" });
  }
});

// Generates a portrait for an NPC from its imageTags and returns it as a cached local URL.
npcTrackerRouter.post("/portrait", async (req, res) => {
  const { imageTags } = req.body as { imageTags?: string };
  if (!imageTags || typeof imageTags !== "string") {
    res.status(400).json({ error: "imageTags is required" });
    return;
  }

  const comfySettings = await comfyInjectSettingsStore.getComfyInjectSettings();
  if (!comfySettings.enabled) {
    res.status(409).json({ error: "ComfyInject is disabled" });
    return;
  }

  try {
    const seed = Math.floor(Math.random() * 9007199254740991);
    const result = await generateImage({ prompt: imageTags, ar: "PORTRAIT", shot: "CLOSE", seed }, comfySettings);
    const url = await cacheImage(result.imageUrl);
    res.json({ pfp: url });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Portrait generation failed" });
  }
});
