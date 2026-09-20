// Teaches the *main roleplay model* the [[IMG:...]] marker syntax — the one piece of
// ComfyInject that isn't image-gen config. Real SillyTavern users write this by hand inside a
// preset's own prompt (it's the only reason a model ever writes markers at all); this gives
// ComfyInject a working default with zero setup, same "disabled means defaults are used"
// pattern as Roleplay's own "Advanced: Edit Prompts" panels.
import type { AspectRatioToken, ComfyInjectSettings } from "../types/comfyInject";

const AR_TOKENS: AspectRatioToken[] = ["PORTRAIT", "SQUARE", "LANDSCAPE", "CINEMA"];

export function buildDefaultComfyInjectDirective(settings: ComfyInjectSettings): string {
  const shotTokens = Object.keys(settings.shot_tags ?? {});
  const shotList = shotTokens.length > 0 ? shotTokens.join(", ") : "MEDIUM";
  return [
    "## IMAGE GENERATION",
    "When a moment is worth showing visually, write an image marker on its own line, in this exact format:",
    "[[IMG: <comma-separated Danbooru tags, English> | <AR> | <SHOT> | <SEED>]]",
    "",
    `- AR (aspect ratio) — exactly one of: ${AR_TOKENS.join(", ")}.`,
    `- SHOT (camera framing) — exactly one of: ${shotList}.`,
    "- SEED — RANDOM (new character or scene), LOCK (keep the previous image's look), or a specific integer to match an earlier generation.",
    "- Tags describe only what a camera would see: no prose, no dialogue inside the marker — pure Danbooru tags, comma-separated.",
    "- Defaults if a segment is omitted: AR=SQUARE, SHOT=MEDIUM, SEED=RANDOM.",
  ].join("\n");
}

export function buildComfyInjectMacro(settings: ComfyInjectSettings | null, characterImageTags?: string): string {
  if (!settings?.enabled) return "";
  // Director Mode: don't teach the main model to write [[IMG:...]] tags.
  // The Image Director handles tag insertion. ComfyInject still renders them.
  if (settings.directorMode) return "";
  const base =
    settings.customDirectiveEnabled && settings.customDirective.trim()
      ? settings.customDirective
      : buildDefaultComfyInjectDirective(settings);
  if (characterImageTags?.trim()) {
    return `${base}\n\n## CHARACTER VISUAL IDENTITY\nFor {{char}}, always start the character's appearance tags from: ${characterImageTags}. Add only scene/pose/expression tags on top — never change the character's core appearance tags (hair, eyes, skin, body) unless the story explicitly changes them.`;
  }
  return base;
}
