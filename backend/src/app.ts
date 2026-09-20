import path from "node:path";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { chatsRouter } from "./routes/chats.js";
import { charactersRouter } from "./routes/characters.js";
import { personasRouter } from "./routes/personas.js";
import { samplingPresetsRouter } from "./routes/samplingPresets.js";
import { settingsRouter } from "./routes/settings.js";
import { comfyInjectRouter } from "./routes/comfyInject.js";
import { recastRouter } from "./routes/recast.js";
import { estudioRouter } from "./routes/estudio.js";
import { imageDirectorRouter } from "./routes/imageDirector.js";
import { plumaRouter } from "./routes/pluma.js";
import { providersRouter } from "./routes/providers.js";
import { titleRouter } from "./routes/title.js";
import { importRouter } from "./routes/import.js";
import { npcTrackerRouter } from "./routes/npcTracker.js";
import { usageRouter } from "./routes/usage.js";
import { favoriteNpcsRouter } from "./routes/favoriteNpcs.js";
import { lorebooksRouter } from "./routes/lorebooks.js";
import { activeMemoryRouter } from "./routes/activeMemory.js";
import { activeMemoryGuardRouter } from "./routes/activeMemoryGuard.js";

export function createApp() {
  const app = express();

  const localOrigins = new Set([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  // Browsers may still call the API directly from a local tool without an
  // Origin header. Any browser origin outside the local development/runtime
  // URLs receives no CORS grant.
  app.use(cors({
    origin: (origin, callback) => {
      callback(null, !origin || localOrigins.has(origin));
    },
  }));
  app.use(express.json({ limit: "10mb" }));

  // Request logging — only failures (4xx/5xx). Successful calls (including the
  // noisy settings GETs) are left to the LLM-level logging in openrouter.ts.
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const start = Date.now();
    res.on("finish", () => {
      if (res.statusCode >= 400) {
        console.log(`[HTTP] ✗ ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
      }
    });
    next();
  });

  app.use("/api/chat", chatRouter);
  app.use("/api/chats", chatsRouter);
  // Mounted on the same prefix as chatsRouter: its own routes never match `/x/memory`, so these
  // fall through cleanly without Shadowing any existing chat endpoint.
  app.use("/api/chats", activeMemoryRouter);
  app.use("/api/chats", activeMemoryGuardRouter);
  app.use("/api/characters", charactersRouter);
  app.use("/api/personas", personasRouter);
  app.use("/api/sampling-presets", samplingPresetsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/comfyinject", comfyInjectRouter);
  app.use("/api/recast", recastRouter);
  app.use("/api/estudio", estudioRouter);
  app.use("/api/image-director", imageDirectorRouter);
  app.use("/api/pluma", plumaRouter);
  app.use("/api/providers", providersRouter);
  app.use("/api/generate-title", titleRouter);
  app.use("/api/import", importRouter);
  app.use("/api/npc", npcTrackerRouter);
  app.use("/api/usage", usageRouter);
  app.use("/api/favorite-npcs", favoriteNpcsRouter);
  app.use("/api/lorebooks", lorebooksRouter);

  // Serve the built frontend (SPA) so the one-command launcher only needs the backend running.
  const frontendDist = path.resolve(process.cwd(), "..", "frontend", "dist");
  // Vite names every bundle after its content hash, so anything under /assets can be kept forever.
  // `index.html` (the one file that must never be stale) is served below with revalidation.
  app.use("/assets", express.static(path.join(frontendDist, "assets"), { maxAge: "365d", immutable: true }));
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    // The shell is the one file that must never be served from a stale cache: it names the bundle.
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  return app;
}
