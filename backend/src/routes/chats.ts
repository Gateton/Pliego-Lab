import { randomUUID } from "node:crypto";
import { Router } from "express";
import * as chatStore from "../services/chatStore.js";
import * as characterStore from "../services/characterStore.js";
import * as personaStore from "../services/personaStore.js";
import type { ChatMessage } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const chatsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

chatsRouter.param("id", (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: "Invalid chat id" });
    return;
  }
  next();
});

chatsRouter.get("/", async (_req, res) => {
  res.json(await chatStore.listChats());
});

chatsRouter.post("/", async (req, res) => {
  const { characterId, personaId } = req.body as { characterId?: string; personaId?: string };

  let seedMessages: ChatMessage[] | undefined;
  let title: string | undefined;

  if (characterId !== undefined) {
    const character = await characterStore.readCharacter(characterId);
    if (!character) {
      res.status(400).json({ error: "characterId does not exist" });
      return;
    }
    title = character.name;
    if (character.first_mes) {
      // Stored raw (macros unresolved) — substitution happens at render/prompt-build time.
      seedMessages = [
        {
          id: randomUUID(),
          role: "assistant",
          swipes: [character.first_mes],
          activeSwipeIndex: 0,
          createdAt: Date.now(),
        },
      ];
    }
  }

  if (personaId !== undefined) {
    const persona = await personaStore.getPersona(personaId);
    if (!persona) {
      res.status(400).json({ error: "personaId does not exist" });
      return;
    }
  }

  const chat = await chatStore.createChat({
    characterId: characterId ?? null,
    personaId: personaId ?? null,
    seedMessages,
    title,
  });
  res.status(201).json(chat);
});

chatsRouter.get("/:id", async (req, res) => {
  const chat = await chatStore.readChat(req.params.id);
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  res.json(chat);
});

chatsRouter.put("/:id/rename", async (req, res) => {
  const { title } = req.body as { title?: string };
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const chat = await chatStore.renameChat(req.params.id, title.trim());
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  res.json(chat);
});

chatsRouter.put("/:id", async (req, res) => {
  const { title, messages, extensionData, npcs, npcTracker, personaId, variables, visualState } = req.body as {
    title?: string;
    messages?: unknown;
    extensionData?: Record<string, unknown>;
    npcs?: import("../types.js").NpcRecord[];
    npcTracker?: import("../types.js").Chat["npcTracker"];
    personaId?: string | null;
    variables?: Record<string, string>;
    visualState?: import("../types.js").Chat["visualState"];
  };
  if (typeof title !== "string" || !Array.isArray(messages)) {
    res.status(400).json({ error: "title and messages are required" });
    return;
  }

  let validatedPersonaId: string | null | undefined;
  if (personaId === null) {
    validatedPersonaId = null;
  } else if (typeof personaId === "string") {
    const persona = await personaStore.getPersona(personaId);
    if (!persona) {
      res.status(400).json({ error: "personaId does not exist" });
      return;
    }
    validatedPersonaId = personaId;
  }

  const chat = await chatStore.updateChat(req.params.id, {
    title,
    messages,
    extensionData,
    npcs,
    npcTracker,
    personaId: validatedPersonaId,
    variables,
    visualState,
  });
  if (!chat) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  res.json(chat);
});

chatsRouter.delete("/:id", async (req, res) => {
  const deleted = await chatStore.deleteChat(req.params.id);
  if (!deleted) {
    res.status(404).json(apiErrorBody("chat.notFound"));
    return;
  }
  res.status(204).end();
});
