// Port of comfyinject3.0/src/outbound.js's idea: before sending chat history to the LLM,
// already-generated images are compacted back into a token-efficient marker instead of a
// full image blob — keeping seed/prompt continuity for LOCK without wasting context tokens.
//
// IMPORTANT: the compacted marker MUST keep the full `[[IMG: prompt | AR | SHOT | seed ]]`
// shape. An earlier version wrote only `[[IMG: prompt | seed ]]` (no AR/SHOT), and the model
// — seeing that degenerate 2-segment form in its own history — mimicked it and stopped
// emitting AR/SHOT, which made every image fall back to the parser's SHOT=MEDIUM default.
import type { GeneratedImageResult } from "../types/comfyInject";
import { splitTextWithMarkers } from "./imageMarkers";

const VALID_AR = new Set(["PORTRAIT", "SQUARE", "LANDSCAPE", "CINEMA"]);
const VALID_SHOT = new Set([
  "CLOSE",
  "MEDIUM",
  "WIDE",
  "DUTCH",
  "OVERHEAD",
  "LOWANGLE",
  "HIGHANGLE",
  "PROFILE",
  "BACKVIEW",
  "POV",
]);

/**
 * Recovers the AR/SHOT control tokens the model originally wrote inside a raw marker.
 * `result.ar`/`result.shot` are EFFECTIVE values ("LOCKED" when the global resolution/shot
 * locks override the marker), not what the model intended — so we read the raw marker instead.
 * Falls back to PORTRAIT/MEDIUM when the model wrote no explicit token (degenerate marker).
 */
function recoverArShot(rawMarker: string): { ar: string; shot: string } {
  const inner = rawMarker.match(/\[\[IMG:\s*(.+?)\s*\]\]/s)?.[1] ?? "";
  let ar = "PORTRAIT";
  let shot = "MEDIUM";
  for (const seg of inner.split("|")) {
    const token = seg.trim();
    if (VALID_AR.has(token)) ar = token;
    else if (VALID_SHOT.has(token)) shot = token;
  }
  return { ar, shot };
}

export function compactImagesForOutbound(
  text: string,
  images: Record<string, GeneratedImageResult> | undefined,
  swipeIndex: number,
): string {
  if (!images || !hasAnyOkImage(images)) return text;

  return splitTextWithMarkers(text)
    .map((segment) => {
      if (segment.type === "text") return segment.content;
      const result = images[`${swipeIndex}:${segment.index}`];
      if (result?.status !== "ok") return segment.raw;
      const { ar, shot } = recoverArShot(result.rawMarker);
      return `[[IMG: ${result.prompt} | ${ar} | ${shot} | ${result.seed} ]]`;
    })
    .join("");
}

function hasAnyOkImage(images: Record<string, GeneratedImageResult>): boolean {
  return Object.values(images).some((r) => r.status === "ok");
}

/**
 * Removes every [[IMG:...]] marker from `text`, leaving all other content (prose,
 * <font color> dialogue, <div>/<details> diegetic HTML, etc.) byte-for-byte intact.
 * Used in Director Mode to keep the main model from seeing the Director's tags in
 * history — which would otherwise teach it to write its own markers via few-shot.
 * Surgical by construction: splitTextWithMarkers only ever matches [[IMG: ... ]].
 */
export function stripImageMarkers(text: string): string {
  return splitTextWithMarkers(text)
    .filter((segment) => segment.type === "text")
    .map((segment) => segment.content)
    .join("");
}
