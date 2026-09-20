import { Router } from "express";
import { getFavoriteNpcs, addFavoriteNpc, removeFavoriteNpc } from "../services/favoriteNpcsStore.js";
import type { NpcRecord } from "../types.js";
import { apiErrorBody } from "../services/apiError.js";

export const favoriteNpcsRouter = Router();

favoriteNpcsRouter.get("/", async (_req, res) => {
  res.json(await getFavoriteNpcs());
});

favoriteNpcsRouter.post("/", async (req, res) => {
  const { name, values, pfp } = req.body as Partial<NpcRecord>;
  if (typeof name !== "string" || !name.trim() || typeof values !== "object" || !values) {
    res.status(400).json({ error: "name and values are required" });
    return;
  }
  const favorite = await addFavoriteNpc({ name, values, ...(pfp ? { pfp } : {}) });
  res.status(201).json(favorite);
});

favoriteNpcsRouter.delete("/:id", async (req, res) => {
  const removed = await removeFavoriteNpc(req.params.id);
  if (!removed) {
    res.status(404).json(apiErrorBody("npc.favoriteNotFound"));
    return;
  }
  res.status(204).end();
});
