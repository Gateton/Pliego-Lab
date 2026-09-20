// Port of comfyinject3.0/src/parse.js's processAllImageMarkers/parseSingleMarker
// orchestration — composes the pure parser, seed resolution, and the ComfyUI client.
import { MARKER_REGEX_GLOBAL, parseMarkerContent, parseSingleMarker, type ParsedMarker } from "./markerParser.js";
import { resolveSeed } from "./seedState.js";
import { generateImage } from "./comfyClient.js";
import { cacheImage } from "./imageCache.js";
import type { Chat, ComfyInjectSettings, GeneratedImageResult } from "../../types.js";

type OkParsedMarker = Extract<ParsedMarker, { status: "ok" }>;

function resolveFinalSeedToken(seedToken: string, settings: ComfyInjectSettings, bypassSeedLock: boolean): string {
  if (settings.seed_lock_enabled && !bypassSeedLock) {
    return settings.seed_lock_mode === "CUSTOM" ? String(settings.seed_lock_value) : settings.seed_lock_mode;
  }
  return seedToken;
}

async function generateForParsedMarker(
  parsed: OkParsedMarker,
  rawMarker: string,
  settings: ComfyInjectSettings,
  chat: Chat,
  beforeMessageId: string | undefined,
  bypassSeedLock: boolean,
): Promise<GeneratedImageResult> {
  try {
    const seedToken = resolveFinalSeedToken(parsed.seedToken, settings, bypassSeedLock);
    const seed = resolveSeed(seedToken, chat, beforeMessageId);
    const result = await generateImage({ prompt: parsed.prompt, ar: parsed.ar, shot: parsed.shot, seed }, settings);
    const url = await cacheImage(result.imageUrl);
    return {
      status: "ok",
      url,
      seed: result.seed,
      prompt: result.prompt,
      ar: result.effectiveAr,
      shot: result.effectiveShot,
      rawMarker,
      checkpoint: result.effectiveCheckpoint,
      loras: result.effectiveLoras.filter((l) => l.name),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    console.error("[ComfyInject] generation failed:", error);
    return { status: "generation_error", reason, rawMarker };
  }
}

/**
 * Finds every `[[IMG: ...]]` marker in `text`, parses and generates them one by one
 * (sequentially — later markers in the same message can LOCK onto the seed a prior
 * marker just generated). Never throws: each marker degrades independently.
 */
export async function processAllImageMarkers(
  text: string,
  settings: ComfyInjectSettings,
  chat: Chat,
  beforeMessageId: string | undefined,
): Promise<GeneratedImageResult[]> {
  const matches = [...text.matchAll(MARKER_REGEX_GLOBAL)];
  if (matches.length === 0) return [];

  const results: GeneratedImageResult[] = [];
  for (const match of matches) {
    const rawMarker = match[0];
    const parsed = parseMarkerContent(match[1]);
    if (parsed.status === "parse_error") {
      results.push({ status: "parse_error", reason: parsed.reason, rawMarker });
      continue;
    }
    results.push(await generateForParsedMarker(parsed, rawMarker, settings, chat, beforeMessageId, false));
  }
  return results;
}

/** Re-generates one marker, forcing a brand-new random seed regardless of its own token or the global lock. */
export async function retrySingleMarker(
  rawMarker: string,
  settings: ComfyInjectSettings,
  chat: Chat,
  beforeMessageId: string | undefined,
): Promise<GeneratedImageResult> {
  const parsed = parseSingleMarker(rawMarker);
  if (parsed.status === "parse_error") {
    return { status: "parse_error", reason: parsed.reason, rawMarker };
  }
  return generateForParsedMarker({ ...parsed, seedToken: "RANDOM" }, rawMarker, settings, chat, beforeMessageId, true);
}

/** Generates one marker for the first time, respecting its own seed token and the global seed lock. */
export async function generateSingleMarker(
  rawMarker: string,
  settings: ComfyInjectSettings,
  chat: Chat,
  beforeMessageId: string | undefined,
): Promise<GeneratedImageResult> {
  const parsed = parseSingleMarker(rawMarker);
  if (parsed.status === "parse_error") {
    return { status: "parse_error", reason: parsed.reason, rawMarker };
  }
  return generateForParsedMarker(parsed, rawMarker, settings, chat, beforeMessageId, false);
}
