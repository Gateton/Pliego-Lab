import { Router } from "express";
import * as settingsStore from "../services/settingsStore.js";
import { parsePromptBlocks } from "../services/promptBlocks.js";
import type { AppSettings } from "../types.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  res.json(await settingsStore.getSettings());
});

settingsRouter.put("/", async (req, res) => {
  const {
    contextTemplate,
    contextTemplateEnabled,
    promptBlocks,
    defaultPersonaId,
    activeSamplingPresetId,
    streaming,
    chatFontSize,
    chatImageSize,
    density,
    outputLanguage,
    coloredDialogue,
    favoriteCharacterIds,
  } = req.body as Record<string, unknown>;

  if (typeof contextTemplate !== "string") {
    res.status(400).json({ error: "contextTemplate must be a string" });
    return;
  }

  const settings = await settingsStore.patchSettings({
    contextTemplate,
    contextTemplateEnabled: typeof contextTemplateEnabled === "boolean" ? contextTemplateEnabled : true,
    promptBlocks: parsePromptBlocks(promptBlocks),
    defaultPersonaId: typeof defaultPersonaId === "string" ? defaultPersonaId : null,
    activeSamplingPresetId: typeof activeSamplingPresetId === "string" ? activeSamplingPresetId : null,
    streaming: typeof streaming === "boolean" ? streaming : true,
    chatFontSize: typeof chatFontSize === "number" && chatFontSize >= 10 && chatFontSize <= 40 ? chatFontSize : 16,
    chatImageSize: typeof chatImageSize === "number" && chatImageSize >= 20 && chatImageSize <= 100 ? chatImageSize : 100,
    density: density === "compact" ? "compact" : "comfortable",
    outputLanguage: typeof outputLanguage === "string" ? outputLanguage.slice(0, 40) : "",
    coloredDialogue: typeof coloredDialogue === "boolean" ? coloredDialogue : true,
    favoriteCharacterIds: Array.isArray(favoriteCharacterIds)
      ? favoriteCharacterIds.filter((id): id is string => typeof id === "string")
      : [],
  });
  res.json(settings);
});

/**
 * Onboarding bookkeeping lives outside the main payload on purpose: those fields are written only
 * by this route, so a client sending a stale full settings object through PUT cannot wipe them.
 */
settingsRouter.post("/onboarding", async (req, res) => {
  const { wizardVersion, tourVersion } = req.body as { wizardVersion?: unknown; tourVersion?: unknown };
  const patch: Partial<AppSettings> = {};
  if (typeof wizardVersion === "number" && Number.isFinite(wizardVersion)) patch.onboardingWizardVersion = wizardVersion;
  if (typeof tourVersion === "number" && Number.isFinite(tourVersion)) patch.onboardingTourVersion = tourVersion;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "wizardVersion or tourVersion must be a number" });
    return;
  }
  res.json(await settingsStore.patchSettings(patch));
});
