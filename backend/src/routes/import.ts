import { readFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import * as importConfigStore from "../services/importConfigStore.js";
import { listUsers, scan } from "../services/sillyTavernScan.js";
import { parseCompletionPreset } from "../services/sillyTavernImport.js";
import { readCharaChunk, PngCardError } from "../services/pngCard.js";
import { normalizeCardJson } from "../services/characterCard.js";
import * as characterStore from "../services/characterStore.js";
import * as samplingPresetStore from "../services/samplingPresetStore.js";
import * as personaStore from "../services/personaStore.js";
import * as lorebookStore from "../services/lorebooks.js";
import { apiErrorBody } from "../services/apiError.js";

export const importRouter = Router();

importRouter.get("/config", async (_req, res) => {
  res.json(await importConfigStore.getImportConfig());
});

importRouter.put("/config", async (req, res) => {
  const { sillyTavernPath } = req.body as { sillyTavernPath?: string };
  if (typeof sillyTavernPath !== "string" || !sillyTavernPath.trim()) {
    res.status(400).json({ error: "sillyTavernPath is required" });
    return;
  }
  const users = await listUsers(sillyTavernPath);
  if (users.length === 0) {
    res.status(400).json(apiErrorBody("st.notAnInstall"));
    return;
  }
  const config = await importConfigStore.updateImportConfig({ sillyTavernPath });
  res.json({ ...config, users });
});

importRouter.get("/scan", async (req, res) => {
  const { sillyTavernPath } = await importConfigStore.getImportConfig();
  if (!sillyTavernPath) {
    res.status(400).json(apiErrorBody("st.pathRequired"));
    return;
  }
  const users = await listUsers(sillyTavernPath);
  const user = typeof req.query.user === "string" && users.includes(req.query.user) ? req.query.user : users[0];
  if (!user) {
    res.status(400).json(apiErrorBody("st.noUser"));
    return;
  }
  const result = await scan(sillyTavernPath, user);
  res.json({ ...result, users, activeUser: user });
});

interface ApplyResult {
  importedCharacters: number;
  importedPresets: number;
  importedPersonas: number;
  importedLorebooks: number;
  errors: string[];
}

importRouter.post("/apply", async (req, res) => {
  const { sillyTavernPath } = await importConfigStore.getImportConfig();
  if (!sillyTavernPath) {
    res.status(400).json(apiErrorBody("st.pathRequired"));
    return;
  }

  const { user, characters, presets, personas, lorebooks } = req.body as {
    user?: string;
    characters?: string[];
    presets?: string[];
    personas?: { avatarFile: string; name: string; description: string }[];
    lorebooks?: string[];
  };
  if (typeof user !== "string" || !user) {
    res.status(400).json({ error: "user is required" });
    return;
  }

  const userDir = path.join(sillyTavernPath, "data", user);
  const result: ApplyResult = { importedCharacters: 0, importedPresets: 0, importedPersonas: 0, importedLorebooks: 0, errors: [] };

  for (const file of characters ?? []) {
    try {
      const buffer = await readFile(path.join(userDir, "characters", file));
      const json = readCharaChunk(buffer);
      const fields = normalizeCardJson(JSON.parse(json));
      if (!fields.name) throw new Error("no name");
      await characterStore.createCharacter(fields, buffer);
      result.importedCharacters++;
    } catch (error) {
      const message = error instanceof PngCardError || error instanceof Error ? error.message : "unknown error";
      result.errors.push(`Character "${file}": ${message}`);
    }
  }

  for (const file of presets ?? []) {
    try {
      const raw = JSON.parse(await readFile(path.join(userDir, "OpenAI Settings", file), "utf-8"));
      const { preset } = parseCompletionPreset(raw, path.basename(file, ".json"));
      await samplingPresetStore.createSamplingPreset(preset);
      result.importedPresets++;
    } catch (error) {
      result.errors.push(`Preset "${file}": ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  for (const file of lorebooks ?? []) {
    try {
      const raw = JSON.parse(await readFile(path.join(userDir, "worlds", file), "utf-8"));
      await lorebookStore.createLorebook(raw, path.basename(file, ".json"), "sillytavern");
      result.importedLorebooks++;
    } catch (error) {
      result.errors.push(`Lorebook "${file}": ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  for (const persona of personas ?? []) {
    try {
      await personaStore.createPersona({ name: persona.name, description: persona.description });
      result.importedPersonas++;
    } catch (error) {
      result.errors.push(`Persona "${persona.name}": ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  res.json(result);
});
