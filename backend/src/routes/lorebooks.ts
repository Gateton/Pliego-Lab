import { Router } from "express";
import multer from "multer";
import * as lorebooks from "../services/lorebooks.js";
import * as characterStore from "../services/characterStore.js";
import * as personaStore from "../services/personaStore.js";
import type { Chat } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const lorebooksRouter = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

lorebooksRouter.get("/settings", async (_req, res) => res.json(await lorebooks.getLorebookSettings()));
lorebooksRouter.put("/settings", async (req, res) => res.json(await lorebooks.saveLorebookSettings(req.body ?? {})));
lorebooksRouter.get("/", async (_req, res) => res.json(await lorebooks.listLorebooks()));

lorebooksRouter.post("/", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) { res.status(400).json(apiErrorBody("lorebook.nameRequired")); return; }
  res.status(201).json(await lorebooks.createLorebook({ ...req.body, name, entries: req.body.entries ?? {} }, name, "native"));
});

lorebooksRouter.post("/import", upload.single("file"), async (req, res) => {
  try {
    const raw = req.file ? JSON.parse(req.file.buffer.toString("utf8")) : req.body;
    if (!raw || typeof raw !== "object" || !raw.entries || typeof raw.entries !== "object") {
      res.status(400).json(apiErrorBody("lorebook.invalidFile")); return;
    }
    const fallback = req.file?.originalname.replace(/\.json$/i, "") || "Lorebook importado";
    res.status(201).json(await lorebooks.createLorebook(raw, fallback, "sillytavern"));
  } catch { res.status(400).json(apiErrorBody("lorebook.invalidJsonFile")); }
});

lorebooksRouter.post("/scan-preview", async (req, res) => {
  const chat = req.body?.chat as Chat | undefined;
  if (!chat || !Array.isArray(chat.messages)) { res.status(400).json({ error: "chat is required" }); return; }
  const [character, persona] = await Promise.all([
    chat.characterId ? characterStore.readCharacter(chat.characterId) : null,
    chat.personaId ? personaStore.getPersona(chat.personaId) : null,
  ]);
  res.json(await lorebooks.scanLorebooks({ chat, character, persona, maxContextTokens: Number(req.body.maxContextTokens) || 8000, trigger: typeof req.body.trigger === "string" ? req.body.trigger : "normal" }));
});

lorebooksRouter.param("id", (req, res, next, id) => { if (!UUID_RE.test(id)) { res.status(400).json({ error: "Invalid lorebook id" }); return; } next(); });
lorebooksRouter.get("/:id", async (req, res) => { const book = await lorebooks.getLorebook(req.params.id); if (!book) { res.status(404).json(apiErrorBody("lorebook.notFound")); return; } res.json(book); });
lorebooksRouter.put("/:id", async (req, res) => { const book = await lorebooks.updateLorebook(req.params.id, req.body); if (!book) { res.status(404).json(apiErrorBody("lorebook.notFound")); return; } res.json(book); });
lorebooksRouter.delete("/:id", async (req, res) => { if (!(await lorebooks.deleteLorebook(req.params.id))) { res.status(404).json(apiErrorBody("lorebook.notFound")); return; } res.status(204).end(); });
// The copy's name is written by the client, which knows the interface language; the suffix here is
// only the fallback for a caller that does not send one.
lorebooksRouter.post("/:id/duplicate", async (req, res) => {
  const source = await lorebooks.getLorebook(req.params.id);
  if (!source) { res.status(404).json(apiErrorBody("lorebook.notFound")); return; }
  const requested = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const name = requested || `${source.name} — copia`;
  res.status(201).json(await lorebooks.createLorebook({ ...source, id: undefined, name }, name, "native"));
});
lorebooksRouter.get("/:id/export", async (req, res) => { const book = await lorebooks.getLorebook(req.params.id); if (!book) { res.status(404).json(apiErrorBody("lorebook.notFound")); return; } const { id: _id, description: _description, createdAt: _createdAt, updatedAt: _updatedAt, source: _source, ...compatible } = book; res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(book.name)}.json"`); res.type("application/json").send(JSON.stringify(compatible, null, 2)); });
