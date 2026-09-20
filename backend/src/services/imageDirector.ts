// Image Director pipeline — sends text to a secondary model that inserts [[IMG:...]] tags
// at narratively appropriate moments. ComfyInject then renders those tags as images.
import { completeChat, type GenerationMeta, type SamplingParams } from "./llm.js";
import type { CharacterVisualState, DirectorStateUpdate, ImageDirectorSettings } from "../types.js";

const ENHANCED_SYSTEM_PROMPT = `You are an image director for a roleplay story. Your ONLY job: read the text and insert [[IMG:...]] tags at the best visual moments.

OUTPUT FORMAT — insert this EXACT syntax inline, at the end of the sentence/paragraph it illustrates:
[[IMG: <comma-separated Danbooru tags> | <AR> | <SHOT> | <SEED>]]

══════════════════════════════════════════
CAPTURE THE ACTION (most important)
══════════════════════════════════════════
Identify the MAIN VERB of the scene — what is actually happening — and make the image SHOW it. A face or a mood is WRONG when the text describes an action. Translate the verb into pose/body tags — and always match tags to who is ACTUALLY involved, never a hetero pairing by default.
  "she rides him" → 1girl, cowgirl position, straddling, hands on his chest, male hips beneath her (ONE 1girl block — he's a body-part reference, never his own "1boy" block)
  "she kisses her" → 1girl, leaning in, kissing, eyes closed, close to another's face, female lips against hers (ONE 1girl block — the partner is a body-part reference, never a second block). Consider POV from the kissed character's perspective if it fits the beat. Same logic for any pairing — swap the gender word for whoever the actual partner is, and swap the acting/receiving roles freely; never assume from the example's wording.
  "he slams the table" → fist on table, leaning forward

══════════════════════════════════════════
TWO CHARACTERS IN INTERACTION
══════════════════════════════════════════
If TWO characters are engaged in the SAME action (sex, kiss, hug, combat), ONE of them gets the full tag chain — whoever the shot is about — and the OTHER is represented ONLY through gender-qualified body-part/contact tags (arms, hands, torso, lips, chest — see BODY INTERACTION TAGS). NEVER give the second participant their own gender-count tag (1girl/1boy) in this image, no matter how visible the scene describes them as being. PREFER POV or a tight, implied-partner framing — it explains naturally why only one full body is on screen. Derive each participant's actual gender/identity from CHARACTER CONTEXT / PERSONA CONTEXT / KNOWN NPCs / the prose — NEVER default to male, and never default the actor to female either; both roles can be either gender, independently. A third character merely present/reacting nearby but NOT directly part of THIS action gets no tag block in this image, even if the prose describes them there.
If you genuinely need BOTH participants' faces/expressions shown in independent detail (not just contact), use TWO separate consecutive [[IMG:...]] images instead — each its own full single-character shot, ideally each in POV from the OTHER's perspective (shot/reverse-shot). Never combine two full blocks into one tag chain, for any reason.
  "she licks his foot" → 1girl, kneeling, licking foot, tongue out, holding foot, shy expression (NO "1boy" — only his foot is in frame, his face/torso aren't; add "male foot" only if the tag needs a gender qualifier to render correctly). Same logic with the roles/genders reversed — whoever is kneeling and licking gets the full tags, whoever only offers a foot gets none.
The "one character per image" rule applies ONLY when the scene has ONE character involved in the action.

══════════════════════════════════════════
TAG CONTENT (every tag includes, in this order)
══════════════════════════════════════════
- Quality: masterpiece, best quality, highres, anime, anime coloring
- Rating: rating:safe | rating:questionable | rating:explicit
- Count: exactly ONE 1girl or 1boy, matching whoever the shot is about — never assume male by default, and never a second count tag for a partner (see TWO CHARACTERS IN INTERACTION)
- Appearance: hair, eyes, body — from CHARACTER CONTEXT below (fixed identity, copy it as-is, never re-invented from the scene)
- Outfit: from CHARACTER CONTEXT / current visual state
- Scene: lighting + 2-3 location details + time of day
- Pose/action: the verb from the prose
- Expression: the character's emotion

══════════════════════════════════════════
SHOT · AR · SEED
══════════════════════════════════════════
SHOT: CLOSE (face/emotion), MEDIUM (torso/action), DUTCH (chaos), OVERHEAD (vulnerable), LOWANGLE (power), HIGHANGLE (weak). Intimate scenes → CLOSE or MEDIUM. Never repeat the same SHOT consecutively.
AR: PORTRAIT (2:3), SQUARE (1:1), LANDSCAPE (4:3 or 16:9), CINEMA (21:9).
SEED: RANDOM (new scene), LOCK (same character+scene), <integer> (match previous).

══════════════════════════════════════════
PROHIBITED
══════════════════════════════════════════
WIDE / full body. Multi-pose or composite. Metaphorical objects. Removed clothing as scene objects.

Rules: Maximum {{maxImages}} images — if you find more good moments than that, rank by dramatic weight and keep only the top {{maxImages}}, never make more. NEVER modify the original text — only ADD tags. Tags ALWAYS in English (Danbooru style) — multi-word tags separated by SPACES (e.g. "long hair"), never underscores ("long_hair"). Narrative stays in its original language.`;

const SCENE_STATE_PROMPT = `
══════════════════════════════════════════
SCENE STATE EXTRACTION — do this FIRST, before writing any tag
══════════════════════════════════════════
Read the prose and extract the CURRENT visual state of the scene before tagging:
- WHO is present (and who is interacting with whom).
- WHERE (location) and WHEN (time of day / lighting).
- Each character's CURRENT visual state: what they are wearing RIGHT NOW (or "nude" + only retained accessories), plus any body/hair state (dirty, wet, injured, flushed, sweating, disheveled hair, torn clothing, removed clothing).

The prose is the SOURCE OF TRUTH for current state. The character/NPC descriptions below are only the BASE appearance. If the prose says clothing was removed, torn, dirtied, changed, or the character got wet/dirty/injured, tag THAT current state — never the stale base. Removed clothing never appears in the image. For EVERY character in EVERY image, state the clothing/nudity explicitly: dressed (full outfit tags) OR nude ("nude" + only retained accessories) OR partial (exact remaining garments). A character with no clothing tag renders with random clothes.`;

const RICH_TAGS_PROMPT = `
══════════════════════════════════════════
TAG RICHNESS — FULL TAG CHAIN REQUIRED
══════════════════════════════════════════
Every image MUST carry a full tag chain in this order:
[1] QUALITY: masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, anime, anime coloring
[2] RATING: rating:safe | rating:questionable | rating:explicit
[3] COUNT: 1girl (solo) or 1girl, 1boy (couple)
[4] HAIR: color + length + style + bangs + accessories, then state (wet, disheveled, wind-blown)
[5] EYES: color + shape + direction
[6] FACE: shape + nose + lips + brows + lashes
[7] SKIN/BODY: tone + type + bust + permanent marks, then state (sweat, flushed, wet, blood, bruised)
[8] SPECIES: non-humans only (elf ears, horns, tail, wings, animal ears)
[9] OUTFIT: each garment = color + material + garment (+ state), outermost → innermost. NUDE → "nude" + only retained accessories.
[10] SCENE: mood + lighting, 3-5 location details, objects, time of day
[11] POSE: the verb from the prose
[12] EXPRESSION: keyword + state

Tag richness: 4-8 tags per major slot. NEVER sparse (2-3 tags total = generic image = FAILED).

IDENTITY FIRST: slots [4]-[8] are this character's FIXED physical identity — copy from IDENTITY ANCHORS / CHARACTER CONTEXT AS-IS when given, never re-invented from the current scene. Slots [10]-[12] are the opposite: fully scene-dependent, decided fresh from THIS beat, never carried over from identity.

When a NAMED character appears in the image, emit their FULL chain [1]-[12] — never a partial placeholder like "1girl, sitting".

EXAMPLE (full chain, one character — partner as body-part reference only, never a second block):
masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, anime, anime coloring, rating:explicit, 1girl, long black hair, straight bangs, red eyes, parted lips, flushed cheeks, pale skin, medium breast, thighhighs, black lace choker, bedroom, warm lamplight, rumpled sheets, wooden headboard, night, soft warm light, straddling, cowgirl position, hands on male chest, male hands on her hips, body contact, aroused, half-closed eyes, heavy breathing, body sweat

══════════════════════════════════════════
CLOTHING / NUDITY STATE — MANDATORY IN EVERY IMAGE
══════════════════════════════════════════
Every image MUST state each character's clothing state explicitly. A character with NO clothing tag is a FAILED image — the image model will invent random clothes.

Exactly ONE state per character, always:
- DRESSED: tag EVERY garment as color + material + garment, outermost → innermost.
- NUDE: tag "nude" (or "completely nude") + ONLY retained accessories (collar, bracelets, rings, thighhighs, gloves). ZERO references to removed clothing.
- PARTIAL: tag the exact remaining state — "topless" + lower garment, "bottomless" + upper garment, "lingerie", "underwear", "bikini", "undressing", "taking off clothes", "open shirt", "dress lift", "panties pulled down". Name the SPECIFIC remaining garments.

CONSISTENCY — same beat = same state:
- Every image of the SAME moment/beat MUST carry the SAME clothing state (same outfit, same nudity). If the prose does not change the clothing, do NOT change the tags.
- A clothing change must be EXPLICIT in the prose. Undressing/dressing → tag the exact intermediate state, NEVER "about to remove" + full clothes (the model renders fully clothed).
- If a previous [[IMG:...]] tag in the recent messages established a clothing state and the prose has not changed it, KEEP that same state.`;

/** Shared between PERSISTENT_STATE_PROMPT (attached to normal tag-writing) and the standalone
 * checkVisualState() audit pass — same contract, same rules, whether or not tags are also being
 * written this call. */
const VISUAL_STATE_RULES = `- Add one entry to "stateUpdates" per character whose CLOTHING or visual STATE (wet, injured, dirty, torn, bruised, etc.) changed THIS turn. If nobody's state changed, "stateUpdates" must be [].
- BASELINE INITIALIZATION (separate from the rule above): any character who speaks, acts, or is described THIS turn and has NO entry yet in "## CURRENT VISUAL STATE" above (or that section is entirely absent) MUST get a "stateUpdates" entry establishing their starting outfit RIGHT NOW — this is not a "change" (there was nothing before), it's the first record. Infer it from what the text/scene actually shows; if truly nothing is specified, default to "nude" plus any explicitly-mentioned worn accessory. Set "outfitChanged": true for this entry regardless — from the ledger's perspective going from no-record to a-record IS the thing that has to be written. Never leave a character who appears on-screen with no outfit record at all.
- Losing clothing (fully or partially) is an OUTFIT change, NEVER a state tag: set "outfitChanged": true and "newOutfit": "nude" (+ any retained accessories, e.g. "nude, collar"), or the exact remaining garments for partial undress. Do NOT put "nude" in "stateAdded" — an outfit-only update with "stateAdded": [] is correct and expected.
- "newOutfit" PURITY: it must be a PURE garment tag list, same format/rules as OUTFIT slot [9] elsewhere (color+material+garment, outermost→innermost) — NEVER prose, NEVER a parenthetical explanation of why it changed (no "(removed X per house rule)" or similar). NEVER reference, in any form, a garment that is NOT currently worn — no "removed X", no "no longer wearing X", no negation of any kind. If something was taken off and nothing replaces it, use the PARTIAL NUDITY BY REGION convention ("topless"/"bottomless" — see OUTFIT rules above) or "nude" for full nudity — describe what IS there, never the absence of what was. This is NOT optional: if the upper OR lower body ends up with nothing on it while the other half stays covered, "newOutfit" MUST explicitly include "topless" or "bottomless" — leaving that region out of the tag list entirely (instead of naming it bare) is itself a bug, since a later turn reading this ledger back has no way to know that region is bare.
- "stateAdded"/"stateRemoved" are ONLY for durable physical/appearance conditions that persist across turns without a narrative event changing them (wet, dirty, injured, bruised, tear-streaked face, disheveled hair, sweat, a blush that lingers, etc.) — never personality or behavior tags, never clothing/nudity (that's outfitChanged/newOutfit), and NEVER current pose/activity/action (standing, cooking, carrying something, sitting, walking) — those are derived fresh per image from THIS turn's text via the normal pose tag and must never be stored in the ledger. Also never an accessory-ABSENCE tag ("uncollared", "bare neck") — same rule as clothing: if it's not worn, don't mention it anywhere.
- ACTIVE REVIEW, not just append: every turn, reconsider EVERY tag already on a character's ledger, not only what's new. If a condition has resolved, is no longer contextually true, or was never a durable condition to begin with (see scope above — e.g. a leftover pose/activity tag), put it in "stateRemoved". Only ever adding and never removing is a FAILED update.`;

const PERSISTENT_STATE_PROMPT = `
══════════════════════════════════════════
OUTPUT FORMAT — JSON MODE (overrides the plain-text output format above)
══════════════════════════════════════════
Return ONLY a JSON object — no markdown fences, no prose outside it — in this exact shape:
{"taggedText": "<the full text with [[IMG:...]] tags inserted, following every rule above unchanged>", "stateUpdates": [{"character": "<exact name>", "outfitChanged": <bool>, "newOutfit": "<only when outfitChanged=true — the FULL new outfit, same OUTFIT format as slot [9]>", "stateAdded": ["..."], "stateRemoved": ["..."]}]}

- "taggedText" is the SAME output you would otherwise return as plain text — nothing about the tag-writing rules changes, only the envelope.
${VISUAL_STATE_RULES}
- Never omit "taggedText", even when there are no images to insert — return the original text unchanged inside it in that case.`;

/** Standalone audit pass: verify/correct the visual-state ledger without writing any
 * [[IMG:...]] tags at all — used by the manual "Revisar estado" button, separate from the
 * normal tag-writing pipeline so it can never accidentally insert an unwanted image. */
function buildVisualStateCheckSystemPrompt(): string {
  return `You are auditing the persistent visual-state ledger for an ongoing roleplay scene. Read the text below together with the character/NPC/persona context and the current "## CURRENT VISUAL STATE" ledger, and verify every character's outfit/state is accurate — correct anything wrong, missing, or stale.
You are NOT writing any [[IMG:...]] image tags. This is a standalone accuracy pass over the state ledger only, completely separate from image generation.
Return ONLY a JSON object — no markdown fences, no prose outside it — in this exact shape:
{"stateUpdates": [{"character": "<exact name>", "outfitChanged": <bool>, "newOutfit": "<only when outfitChanged=true — the FULL new outfit, same OUTFIT format as slot [9] elsewhere>", "stateAdded": ["..."], "stateRemoved": ["..."]}]}
${VISUAL_STATE_RULES}
If nothing needs correcting, return {"stateUpdates": []}.`;
}

/** Tolerant parse for the state-only JSON contract above (no "taggedText" field to require). */
function parseStateOnlyJson(content: string): DirectorStateUpdate[] | null {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { stateUpdates?: unknown };
    if (!Array.isArray(parsed.stateUpdates)) return null;
    return parsed.stateUpdates.filter(
      (u): u is DirectorStateUpdate => !!u && typeof u === "object" && typeof (u as DirectorStateUpdate).character === "string",
    );
  } catch {
    return null;
  }
}

function buildMinTagsPrompt(minTags: number): string {
  return `
══════════════════════════════════════════
MINIMUM TAG COUNT — HARD REQUIREMENT
══════════════════════════════════════════
Every [[IMG:...]] tag chain MUST contain AT LEAST ${minTags} comma-separated tags — count them before closing the marker. Fewer than ${minTags} = sparse, generic, FAILED image.
If you're short, add MORE specific detail to SCENE/HAIR/FACE/OUTFIT/POSE/EXPRESSION (per-strand hair detail, fabric texture, background props, lighting nuance) — never pad with vague filler words.`;
}

function buildUserPrompt(text: string, maxImages: number, minTags: number): string {
  const minTagsReminder =
    minTags > 0
      ? `\nHARD REQUIREMENT: every [[IMG:...]] tag chain must contain AT LEAST ${minTags} comma-separated tags. Count them before closing the marker — the example above is short for readability, it is NOT the target count.\n`
      : "";
  return `Insert [[IMG:...]] tags into this text. Maximum ${maxImages} images — HARD LIMIT, not a suggestion. If more than ${maxImages} moments deserve an image, rank them by dramatic weight and only tag the top ${maxImages}; the rest stay as plain narration.
Output the FULL text with tags added. Do NOT modify the narration.

EXAMPLE:
Input: "The knight drew his sword. The dragon roared, flames shooting from its jaws."
Output: "The knight drew his sword. [[IMG: masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, anime, anime coloring, rating:safe, 1girl, medium breast, silver armor, plate armor, gauntlet, helmet, castle gate, stone walls, torchlight, dramatic lighting, high contrast, drawing sword, sword raised, determined, jaw set, narrowed eyes | PORTRAIT | MEDIUM | RANDOM]] The dragon roared, flames shooting from its jaws. [[IMG: masterpiece, best quality, amazing quality, very aesthetic, absurdres, highres, anime, anime coloring, rating:safe, 1girl, red scales, dragon form, sharp teeth, claws, tail, wings spread, volcanic landscape, dark sky, lava glow, smoke, dramatic lighting, fire breath, low angle, open jaw, angry eyes | LANDSCAPE | LOWANGLE | RANDOM]]"
${minTagsReminder}
Now insert tags into this text:

<text>
${text}
</text>

Output the FULL text with [[IMG:...]] tags inserted:`;
}

function buildBaseSampling(settings: ImageDirectorSettings): SamplingParams {
  const params: SamplingParams = {
    temperature: settings.temperature,
    top_p: settings.top_p,
    max_tokens: settings.max_tokens,
  };
  if (settings.thinkingEffort === "off") {
    params.reasoning = { enabled: false };
  } else {
    // Do not discard reasoning: it is useful when diagnosing why no marker was emitted.
    params.reasoning = { effort: settings.thinkingEffort, exclude: false };
  }
  return params;
}

function buildSampling(settings: ImageDirectorSettings): SamplingParams {
  const params = buildBaseSampling(settings);
  // The Director always returns the JSON contract (taggedText + stateUpdates), so the response
  // format is requested unconditionally; parseDirectorJson still tolerates a plain-text reply.
  params.response_format = { type: "json_object" };
  return params;
}

async function generateWithModel(
  system: string,
  user: string,
  model: string,
  sampling: SamplingParams,
  signal: AbortSignal,
): Promise<{ content: string; reasoning: string; meta: GenerationMeta }> {
  const started = Date.now();
  const { content, reasoning, usage, provider, model: usedModel } = await completeChat(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model,
      sampling,
    },
    signal,
  );
  console.log(`[Image Director] ${usedModel} done in ${Date.now() - started}ms (${content.length} chars)`);
  return { content: content.trim(), reasoning, meta: { provider, model: usedModel, usage } };
}

/**
 * Run the Image Director on a piece of text.
 * Returns the text with [[IMG:...]] tags inserted at appropriate points.
 */
export interface DirectorContext {
  character?: { name: string; description: string; personality: string; scenario: string; imageTags: string };
  npcs?: Array<{ name: string; values: Record<string, string> }>;
  persona?: { name: string; imageTags: string };
  recentMessages?: Array<{ role: string; content: string }>;
  visualState?: Record<string, CharacterVisualState>;
}

function buildContextBlock(ctx: DirectorContext, settings: ImageDirectorSettings): string {
  const parts: string[] = [];

  // Character context
  if (settings.includeCharacterContext && ctx.character) {
    const c = ctx.character;
    const charParts: string[] = [];
    if (c.name) charParts.push(`Name: ${c.name}`);
    if (c.description) charParts.push(`Description: ${c.description}`);
    if (c.personality) charParts.push(`Personality: ${c.personality}`);
    if (c.scenario) charParts.push(`Scenario: ${c.scenario}`);
    if (c.imageTags) charParts.push(`Visual appearance (Danbooru tags): ${c.imageTags}`);
    if (charParts.length > 0) {
      parts.push(`## CHARACTER CONTEXT\n${charParts.join("\n")}`);
    }
  }

  // Persona context — the equivalent of CHARACTER CONTEXT for {{user}}. Off by default: only
  // relevant when a scene actually needs to show the persona's body, which isn't every turn,
  // but the cost is small (one short tag list) and — same principle as CHARACTER CONTEXT
  // already follows — deciding WHETHER this turn needs it is left to PARTNER IDENTITY & SCOPE,
  // not pre-filtered here.
  if (settings.includePersonaContext && ctx.persona?.imageTags) {
    parts.push(`## PERSONA CONTEXT\nName: ${ctx.persona.name}\nVisual appearance (Danbooru tags): ${ctx.persona.imageTags}`);
  }

  // NPC Tracker context (always included when there are tracked NPCs).
  if (ctx.npcs && ctx.npcs.length > 0) {
    const npcLines = ctx.npcs.map((npc) => {
      const fields = Object.entries(npc.values)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      return `- ${npc.name}${fields ? ` — ${fields}` : ""}`;
    });
    parts.push(`## KNOWN NPCs\n${npcLines.join("\n")}`);

    // The protagonist's own NPC Tracker entry (when includeMainCharacter is on) can carry
    // appearance/personality/role/background/imageTags once evolution or a scan has filled
    // them — the same fields CHARACTER CONTEXT above already shows from the static Card. Tell
    // the model which one is current instead of leaving two descriptions of the same person
    // to silently disagree.
    const cardOwnedKeys = new Set(["appearance", "personality", "role", "background", "imageTags"]);
    const mainCharKey = ctx.character?.name?.trim().toLowerCase();
    const mainCharNpc = mainCharKey
      ? ctx.npcs.find(
          (npc) => npc.name.trim().toLowerCase() === mainCharKey && Object.entries(npc.values).some(([k, v]) => cardOwnedKeys.has(k) && v),
        )
      : undefined;
    if (mainCharNpc) {
      parts.push(
        `## IDENTITY PRECEDENCE\n"${mainCharNpc.name}"'s entry in KNOWN NPCs reflects their CURRENT/evolved version across the story. If it differs from CHARACTER CONTEXT (their original Character Card), this version wins — the Card is the starting point, not the final state.`,
      );
    }
  }

  // Identity anchors — turns the passive appearance info above into a hard mandate, so the
  // Director copies established tags instead of re-inventing/drifting them turn after turn.
  // Always on (not gated by any toggle) — an untethered identity is never the desired behavior.
  {
    const anchors: string[] = [];
    if (ctx.character?.name && ctx.character.imageTags) {
      anchors.push(
        `- ${ctx.character.name}: copy these identity tags (hair/eyes/face/skin) AS-IS, as a single block right after COUNT — do not spread them out, invent them or change them unless the prose explicitly says so this turn: ${ctx.character.imageTags}`,
      );
    }
    for (const npc of ctx.npcs ?? []) {
      const imageTags = npc.values["imageTags"];
      if (!imageTags) continue;
      anchors.push(
        `- ${npc.name}: copy these identity tags (hair/eyes/face/skin) AS-IS, as a single block right after COUNT — do not spread them out, invent them or change them unless the prose explicitly says so this turn: ${imageTags}`,
      );
    }
    if (anchors.length > 0) {
      parts.push(`## IDENTITY ANCHORS (MANDATORY)\n${anchors.join("\n")}`);
    }
  }

  // Persistent visual state — the current outfit/state ledger, maintained turn over turn as a
  // data record instead of being re-inferred from a shrinking window of raw prose each time.
  if (ctx.visualState) {
    const lines = Object.entries(ctx.visualState)
      .filter(([, s]) => s.outfit || s.state.length > 0)
      .map(([name, s]) => {
        const outfit = s.outfit || "(no record yet — establish one in \"stateUpdates\" this turn)";
        const state = s.state.length > 0 ? s.state.join(", ") : "none";
        return `- ${name}: outfit: ${outfit} | state: ${state}`;
      });
    if (lines.length > 0) {
      parts.push(
        `## CURRENT VISUAL STATE (source of truth — use this instead of re-inferring from old messages)\n${lines.join("\n")}`,
      );
    }
  }

  // Recent messages
  if (settings.contextDepth > 0 && ctx.recentMessages && ctx.recentMessages.length > 0) {
    const depth = Math.min(settings.contextDepth, ctx.recentMessages.length);
    const msgs = ctx.recentMessages.slice(-depth);
    const msgLines = msgs.map((m, i) => {
      // Keep the LAST message full — it anchors the current scene.
      const content = i === msgs.length - 1 ? m.content : m.content.slice(0, 500);
      return `[${m.role}]: ${content}`;
    });
    parts.push(`## RECENT MESSAGES (last ${depth})\n${msgLines.join("\n\n")}`);
  }

  if (parts.length === 0) return "";
  return "\n\n" + parts.join("\n\n");
}

/** Tolerant JSON parse for the persistent-state output contract: strip code fences, take the
 * outermost {...} object — same approach as the NPC scanner's parser, since models don't always
 * honour `response_format` exactly. */
function parseDirectorJson(content: string): { taggedText: string; stateUpdates: DirectorStateUpdate[] } | null {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { taggedText?: unknown; stateUpdates?: unknown };
    if (typeof parsed.taggedText !== "string") return null;
    const stateUpdates = Array.isArray(parsed.stateUpdates)
      ? parsed.stateUpdates.filter(
          (u): u is DirectorStateUpdate => !!u && typeof u === "object" && typeof (u as DirectorStateUpdate).character === "string",
        )
      : [];
    return { taggedText: parsed.taggedText, stateUpdates };
  } catch {
    return null;
  }
}

export interface DirectorResult {
  taggedText: string;
  stateUpdates: DirectorStateUpdate[];
  meta: GenerationMeta;
  diagnostic: {
    response: string;
    reasoning: string;
  };
}

export async function runImageDirector(
  text: string,
  settings: ImageDirectorSettings,
  context?: DirectorContext,
  signal: AbortSignal = new AbortController().signal,
): Promise<DirectorResult> {
  if (!settings.model) {
    throw new Error("No model configured for Image Director");
  }

  // Build system prompt: the enhanced (action-focused) base plus scene-state, rich-tag and
  // persistent-state blocks — all unconditional now that they are no longer user toggles.
  let systemPrompt = ENHANCED_SYSTEM_PROMPT;
  if (settings.instructionPrompt.trim()) {
    systemPrompt += `\n\nADDITIONAL INSTRUCTIONS:\n${settings.instructionPrompt.trim()}`;
  }
  systemPrompt += SCENE_STATE_PROMPT;
  systemPrompt += RICH_TAGS_PROMPT;
  systemPrompt += PERSISTENT_STATE_PROMPT;
  if (settings.minTagsPerImage > 0) {
    systemPrompt += buildMinTagsPrompt(settings.minTagsPerImage);
  }
  if (settings.jailbreakEnabled && settings.jailbreakPrompt.trim()) {
    systemPrompt += `\n\nDIRECTOR PRIORITY OVERRIDE:\n${settings.jailbreakPrompt.trim()}`;
  }
  systemPrompt = systemPrompt.replace(/\{\{maxImages\}\}/g, String(settings.maxImagesPerTurn));


  // Add context (character, NPCs, recent messages)
  let identityAnchorsForAudit = "";
  if (context) {
    const contextBlock = buildContextBlock(context, settings);
    if (contextBlock) systemPrompt += contextBlock;
    const anchorMatch = contextBlock.match(/## IDENTITY ANCHORS \(MANDATORY\)\n([\s\S]*?)(?:\n\n##|$)/);
    if (anchorMatch) identityAnchorsForAudit = anchorMatch[1];
  }
  const userPrompt = buildUserPrompt(text, settings.maxImagesPerTurn, settings.minTagsPerImage);

  console.log(
    `[Image Director] run: model=${settings.model} maxImages=${settings.maxImagesPerTurn} textChars=${text.length} context=${context ? "yes" : "no"}`,
  );
  try {
    const { content: result, reasoning, meta } = await generateWithModel(systemPrompt, userPrompt, settings.model, buildSampling(settings), signal);
    const diagnostic = { response: result, reasoning };

    let taggedTextRaw = result;
    let stateUpdates: DirectorStateUpdate[] = [];
    const parsed = parseDirectorJson(result);
    if (parsed) {
      taggedTextRaw = parsed.taggedText;
      stateUpdates = parsed.stateUpdates;
    } else {
      console.warn(`[Image Director] JSON parse failed — falling back to raw text. Preview: ${result.slice(0, 300)}`);
    }

    // Strip any markdown code fences the model might wrap around the output
    let cleaned = taggedTextRaw;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    }
    cleaned = cleaned.trim();

    // Validate: must contain at least one [[IMG: tag
    const hasImgTags = /\[\[IMG:/.test(cleaned);
    console.log(`[Image Director] result: ${cleaned.length} chars, hasImgTags=${hasImgTags}, stateUpdates=${stateUpdates.length}`);
    if (!hasImgTags) {
      console.warn(`[Image Director] no tags returned. Preview: ${cleaned.slice(0, 300)}`);
      return { taggedText: text, stateUpdates: [], meta, diagnostic };
    }
    let tags = cleaned.match(/\[\[IMG:[\s\S]*?\]\]/g) ?? [];
    if (tags.length === 0) {
      // hasImgTags was true (the literal substring "[[IMG:" is present) but no COMPLETE tag
      // matched — almost always a truncated/malformed response (ran out of tokens mid-tag, or the
      // JSON envelope got cut short). Returning `cleaned` here would leak the dangling, unclosed
      // "[[IMG: ..." fragment straight into the visible message text.
      console.warn(`[Image Director] "[[IMG:" present but no complete tag matched (likely truncated). Preview: ${cleaned.slice(-300)}`);
      return { taggedText: text, stateUpdates, meta, diagnostic };
    }
    if (tags.length > settings.maxImagesPerTurn) {
      console.warn(`[Image Director] model emitted ${tags.length} images, capping to configured max ${settings.maxImagesPerTurn}`);
      let seen = 0;
      cleaned = cleaned
        .replace(/\[\[IMG:[\s\S]*?\]\]/g, (match) => (++seen <= settings.maxImagesPerTurn ? match : ""))
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      tags = cleaned.match(/\[\[IMG:[\s\S]*?\]\]/g) ?? [];
    }
    console.log(`[Image Director] ${tags.length} tags inserted:`);
    if (identityAnchorsForAudit) {
      console.log(`[Image Director] [TagAudit] identity anchors sent this run:\n${identityAnchorsForAudit}`);
    }
    tags.forEach((tag, i) => {
      console.log(`  [${i + 1}] ${tag}`);
      if (settings.minTagsPerImage > 0) {
        const promptBody = tag.replace(/^\[\[IMG:\s*/, "").split("|")[0];
        const tagCount = promptBody.split(",").map((t) => t.trim()).filter(Boolean).length;
        if (tagCount < settings.minTagsPerImage) {
          console.warn(`[Image Director]   ⚠ image ${i + 1} has only ${tagCount} tags (min ${settings.minTagsPerImage})`);
        }
      }
    });

    return { taggedText: cleaned, stateUpdates, meta, diagnostic };
  } catch (error) {
    console.error("[Image Director] Generation failed:", error);
    throw error;
  }
}

export interface VisualStateCheckResult {
  stateUpdates: DirectorStateUpdate[];
  meta: GenerationMeta;
}

/**
 * Standalone audit pass over the persistent visual-state ledger — no [[IMG:...]] tags are
 * written or read. Used by the manual "Revisar estado" button in the Visual State panel, so
 * the user can force a precision re-check against the last message without also generating
 * (or risking generating) any image.
 */
export async function checkVisualState(
  text: string,
  settings: ImageDirectorSettings,
  context?: DirectorContext,
  signal: AbortSignal = new AbortController().signal,
): Promise<VisualStateCheckResult> {
  if (!settings.model) {
    throw new Error("No model configured for Image Director");
  }

  let systemPrompt = buildVisualStateCheckSystemPrompt();
  if (settings.jailbreakEnabled && settings.jailbreakPrompt.trim()) {
    systemPrompt += `\n\nDIRECTOR PRIORITY OVERRIDE:\n${settings.jailbreakPrompt.trim()}`;
  }
  const contextBlock = context ? buildContextBlock(context, settings) : "";
  const userPrompt = `<text>\n${text}\n</text>\n\nAudit the visual state of every character present in this text against the ledger above and return the JSON with the necessary corrections.`;
  const fullSystem = systemPrompt + contextBlock;

  console.log(`[Image Director] checkVisualState: model=${settings.model} textChars=${text.length} context=${context ? "yes" : "no"}`);
  const { content: result, meta } = await generateWithModel(
    fullSystem,
    userPrompt,
    settings.model,
    { ...buildBaseSampling(settings), response_format: { type: "json_object" } },
    signal,
  );

  const stateUpdates = parseStateOnlyJson(result);
  if (!stateUpdates) {
    console.warn(`[Image Director] checkVisualState: JSON parse failed. Preview: ${result.slice(0, 300)}`);
    return { stateUpdates: [], meta };
  }
  console.log(`[Image Director] checkVisualState: ${stateUpdates.length} update(s)`);
  return { stateUpdates, meta };
}

const REACTION_SYSTEM_PROMPT = `You are an image director. Your ONLY job is to write ONE [[IMG:...]] tag chain showing a specific character's reaction to a narrative moment — NOT a neutral portrait.

Format: [[IMG: <comma-separated Danbooru tags> | <AR> | <SHOT> | <SEED>]]

AR — exactly one of these UPPERCASE tokens (never a raw ratio like "16:9"): PORTRAIT (2:3), SQUARE (1:1), LANDSCAPE (4:3 or 16:9), CINEMA (21:9). Reaction shots are almost always PORTRAIT or SQUARE.
SHOT — CLOSE or MEDIUM (reaction shots favor faces/upper body — never WIDE or full body).
SEED — RANDOM.

Output ONLY the single [[IMG:...]] marker — no narration, no commentary, no markdown fences.`;

/**
 * Generates a single reaction-shot [[IMG:...]] for one named NPC responding to the latest
 * narrative beat — used by the `/img NombreNPC` chat command. Reuses the same tag-richness
 * rules as the main pipeline (RICH_TAGS_PROMPT) instead of duplicating them.
 */
export async function runDirectorReaction(
  npc: { name: string; values: Record<string, string> },
  lastMessageText: string,
  settings: ImageDirectorSettings,
): Promise<{ marker: string; meta: GenerationMeta }> {
  if (!settings.model) {
    throw new Error("No model configured for Image Director");
  }
  const imageTags = npc.values["imageTags"] || "";
  let systemPrompt = REACTION_SYSTEM_PROMPT + RICH_TAGS_PROMPT;
  if (settings.jailbreakEnabled && settings.jailbreakPrompt.trim()) {
    systemPrompt += `\n\nDIRECTOR PRIORITY OVERRIDE:\n${settings.jailbreakPrompt.trim()}`;
  }
  const userPrompt = `Character: ${npc.name}
Base appearance tags — ALWAYS start from these, add pose/expression/scene on top: ${imageTags || "(no base tags on record — infer them from the name and the context)"}

Narrative moment to react to:
<text>
${lastMessageText}
</text>

Write the ONE [[IMG:...]] tag chain showing ${npc.name}'s reaction to this moment:`;

  const { content, meta } = await generateWithModel(systemPrompt, userPrompt, settings.model, buildBaseSampling(settings), new AbortController().signal);
  const match = content.match(/\[\[IMG:[\s\S]*?\]\]/);
  if (!match) {
    throw new Error("The Director did not produce a valid reaction image.");
  }
  return { marker: match[0], meta };
}
