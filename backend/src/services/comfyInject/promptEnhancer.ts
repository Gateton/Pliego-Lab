// Rule-based prompt enrichment applied before generation when the user enables it — no LLM,
// no workflow changes. Keeps prompts clean and adds quality/lighting tags the model may have
// skipped, so images stay consistent and mood-appropriate. Mirrors the lighting guidance in
// ComfyInject's own directive so it only fills what the model already knows but forgets.

const QUALITY_LADDER = ["masterpiece", "best quality", "amazing quality", "very aesthetic", "absurdres", "highres"];

// tag → lighting tags. Matched against WHOLE tags (never substrings: "soft" inside "soft skin" or
// "glowing" inside "glowing eyes" is not a mood), and only consulted when the prompt carries no
// lighting at all — a prompt that already lit its scene must not get a second, contradicting light.
// Weather comes before time of day so a rainy night is not lit like a clear one, and every value is
// lighting only: scenery such as a starry sky would contradict the setting the prompt describes.
const MOOD_LIGHTING: [RegExp, string][] = [
  [/^(?:rain|heavy rain|storm|thunderstorm|lightning|overcast)$/i, "overcast, dim lighting"],
  [/^(?:horror|dark|darkness)$/i, "dim lighting, deep shadows"],
  [/^(?:fighting|battle|combat)$/i, "dramatic lighting, high contrast"],
  [/^(?:night|midnight|moonlight)$/i, "moonlight, dim lighting"],
  [/^(?:dawn|sunrise)$/i, "sunrise, soft lighting"],
  [/^(?:dusk|sunset|evening)$/i, "sunset, golden hour"],
  [/^(?:romantic|intimate)$/i, "soft lighting, warm lighting"],
  [/^(?:crying|tears|sad)$/i, "soft lighting, muted colors"],
];

const HAS_LIGHTING_RE = /\b(?:light|lighting|lit|lamplight|torchlight|candlelight|moonlight|sunlight|backlighting|shadow|shadows|glow|golden hour|neon)\b/i;

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t.trim());
  }
  return out;
}

function ensureQuality(tags: string[]): string[] {
  const joined = tags.join(" ").toLowerCase();
  const hasQuality = QUALITY_LADDER.some((q) => joined.includes(q.toLowerCase()));
  return hasQuality ? tags : [...QUALITY_LADDER, ...tags];
}

function applyLighting(tags: string[]): string[] {
  if (tags.some((tag) => HAS_LIGHTING_RE.test(tag))) return tags;
  for (const [re, lighting] of MOOD_LIGHTING) {
    if (tags.some((tag) => re.test(tag.trim()))) return [...tags, lighting];
  }
  return tags;
}

export function enhancePrompt(prompt: string): string {
  let tags = prompt
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  tags = dedupe(tags);
  tags = ensureQuality(tags);
  tags = applyLighting(tags);
  return tags.join(", ");
}
