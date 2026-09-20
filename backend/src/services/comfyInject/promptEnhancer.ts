// Rule-based prompt enrichment applied before generation when the user enables it — no LLM,
// no workflow changes. Keeps prompts clean and adds quality/lighting tags the model may have
// skipped, so images stay consistent and mood-appropriate. Mirrors the lighting guidance in
// ComfyInject's own directive so it only fills what the model already knows but forgets.

const QUALITY_LADDER = ["masterpiece", "best quality", "amazing quality", "very aesthetic", "absurdres", "highres"];

// keyword → lighting tags, tested against the whole (lowercased) prompt.
const MOOD_LIGHTING: [RegExp, string][] = [
  [/\b(tense|tension|danger|threat|threatening)\b/i, "dramatic lighting, high contrast, hard shadows"],
  [/\b(horror|scary|terrifying|dread|nightmare)\b/i, "dim lighting, deep shadows, cold blue light"],
  [/\b(combat|battle|fight|fighting|action)\b/i, "dynamic lighting, high contrast, motion blur"],
  [/\b(tender|intimate|romantic|gentle|soft|caring)\b/i, "soft warm light, low contrast, soft lighting"],
  [/\b(grief|sad|sorrow|mourning|tears)\b/i, "muted tones, cool light, desaturated"],
  [/\b(triumph|victory|heroic|glorious)\b/i, "dramatic lighting, bold contrast, low angle"],
  [/\b(magical|arcane|mystic|enchanted|glowing)\b/i, "magical glow, runic light, unnatural color tint"],
  [/\b(night|midnight|darkness|moonlight|nocturnal)\b/i, "moonlight, starry sky, lamplight, deep shadows"],
  [/\b(dawn|sunrise)\b/i, "orange glow, long shadows, cool tones"],
  [/\b(dusk|sunset)\b/i, "sunset sky, orange-pink clouds, golden hour"],
  [/\b(rain|storm|thunderstorm|thunder|lightning)\b/i, "rain, wet, dramatic lighting, overcast"],
];

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
  const joined = tags.join(", ").toLowerCase();
  const lighting = MOOD_LIGHTING.find(([re]) => re.test(joined))?.[1];
  if (!lighting) return tags;
  const already = lighting.split(", ").some((l) => joined.includes(l.toLowerCase()));
  return already ? tags : [...tags, lighting];
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
