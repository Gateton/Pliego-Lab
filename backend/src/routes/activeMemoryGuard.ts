import { Router } from "express";
import * as chatStore from "../services/chatStore.js";
import { applyGuardReport, checkContinuity } from "../services/activeMemory/guard.js";
import { getActiveMemory, updateActiveMemory } from "../services/activeMemory/store.js";

export const activeMemoryGuardRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_LENGTH = 40_000;

activeMemoryGuardRouter.param("id", (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid chat id" });
    return;
  }
  next();
});

/**
 * Continuity Guard: checks a freshly generated reply against the ledger and reports contradictions.
 * It never rewrites the reply — it only tells the user which canon the model just contradicted, so
 * accepting, correcting or invalidating stays a human decision.
 */
activeMemoryGuardRouter.post("/:id/memory/guard", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }

  const body = req.body as { responseText?: unknown; messageId?: unknown; responderId?: unknown; mode?: unknown; model?: unknown };
  const responseText = typeof body.responseText === "string" ? body.responseText.slice(0, MAX_RESPONSE_LENGTH) : "";
  if (!responseText.trim()) {
    res.status(400).json({ error: "responseText is required" });
    return;
  }

  const state = await getActiveMemory(req.params.id);
  const report = await checkContinuity({
    state,
    responseText,
    messageId: typeof body.messageId === "string" ? body.messageId : undefined,
    responderId: typeof body.responderId === "string" && body.responderId ? body.responderId : undefined,
    mode: body.mode === "heuristic" || body.mode === "llm" || body.mode === "auto" ? body.mode : undefined,
    model: typeof body.model === "string" && body.model ? body.model : undefined,
  });

  // Storing the report is not a canon change, so it deliberately skips the revision log: the panel
  // would otherwise fill with "guard ran" entries that say nothing about what memory knows.
  const stored = await updateActiveMemory(req.params.id, (draft) => {
    applyGuardReport(draft, report);
  });

  res.json({ memory: stored.state, report });
});
